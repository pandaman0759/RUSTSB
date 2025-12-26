import { GoogleGenAI, Type, Schema } from "@google/genai";
import { PosterData } from "../types";

const extractJson = (text: string): any => {
  try {
    const match = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (match) {
      return JSON.parse(match[1]);
    }
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse JSON from Gemini response", e);
    throw new Error("解析 AI 响应失败，请重试。");
  }
};

// 获取网页内容 - 优先使用 Raw HTML 以保留侧边栏信息（价格通常在这里）
const fetchUrlContent = async (url: string): Promise<string> => {
  try {
    // 策略 1: 使用 allorigins 代理获取原始 HTML
    // Jina (策略 2) 虽然好用，但经常会把侧边栏(Sidebar)当作广告或无关内容去除，导致价格信息丢失。
    const proxyResponse = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
    
    if (proxyResponse.ok) {
        const html = await proxyResponse.text();
        // 清理 HTML: 移除脚本、样式、SVG、注释，保留主要结构和文本
        const cleanHtml = html
            .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
            .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
            .replace(/<!--[\s\S]*?-->/g, "")
            .replace(/<svg\b[^>]*>([\s\S]*?)<\/svg>/gim, ""); // SVG 往往很大且无用
        
        // Gemini Flash 1.5/2.0 context 很大，可以稍微放宽长度限制，确保不截断侧边栏
        return cleanHtml.substring(0, 150000); 
    }

    // 策略 2: 如果代理失败，回退到 Jina (转 Markdown)
    console.warn("Proxy failed, falling back to Jina Reader...");
    const jinaResponse = await fetch(`https://r.jina.ai/${url}`);
    if (jinaResponse.ok) {
        const text = await jinaResponse.text();
        return text.substring(0, 50000);
    }

    throw new Error("无法抓取网页内容");
  } catch (error) {
    console.warn("Content fetch failed:", error);
    return ""; // 如果抓取失败，返回空字符串，让 AI 尽力而为
  }
};

export const analyzeUrl = async (url: string): Promise<PosterData> => {
  const getEnvVar = (key: string) => {
    if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) return import.meta.env[key];
    return undefined;
  };

  const apiKey = getEnvVar('API_KEY') || getEnvVar('VITE_API_KEY') || getEnvVar('REACT_APP_API_KEY');

  if (!apiKey) {
    throw new Error("API Key 缺失。请检查 Vercel 环境变量设置。");
  }

  // 1. 先抓取网页内容
  const pageContent = await fetchUrlContent(url);

  const ai = new GoogleGenAI({ apiKey: apiKey });

  const systemInstruction = `
    你是一个专业的 Rust 游戏插件营销海报生成助手。
    
    你的工作流程：
    1. **阅读**：分析用户提供的网页内容（可能是 HTML 源码或 Markdown）。
    2. **提取**：精准提取插件名称、价格、功能点。
    3. **找图**：在内容中寻找图片链接。
    
    ### 核心判断规则（最高优先级）：

    **1. 价格 (Price) - 侧边栏/属性栏挖掘**
    - **现状**：很多论坛（如 RustSB, LoneDesign）将价格放在页面的**侧边栏 (Sidebar)** 或 **顶部/底部的属性框** 中。
    - **搜索策略**：
      - 必须在全文中搜索 **"CNY"**, **"RMB"**, **"USD"**, **"$"**, **"¥"**。
      - 常见格式：\`98.00 CNY\` 或 \`Price: $10.00\` 或 \`售价: 50 RMB\`。
      - 即使在 HTML 的 \`class="price"\` 或 \`label\` 附近，也要提取。
    - **逻辑判断**：
      - 只要找到 \`数字 + 货币单位\`，它就是价格。优先于 "Free" 的判断。
      - **只有**当全文完全找不到任何货币单位时，才填 "免费"。
      - **排除干扰**：如果数字紧跟 "Downloads" (下载量) 或 "Version" (版本)，请忽略。
      - **修正案例**：如果看到 "Downloads: 168" 和 "Price: 98.00 CNY"，必须填 "98.00 CNY"。

    **2. 标签 (Tag)**
    - 优先提取标题中 【】 或 [] 内的词 (如 "原创", "搬运")。
    - 如果标题无标签：
       - 价格是 "免费" -> 填 "免费资源" 或 "原创"。
       - 价格 > 0 -> 填 "付费资源" (禁止填 "付费精选")。
    - **禁止**包含插件名称。

    **3. 插件名称 (Name)**
    - 必须完全去除标题中的 \`【...】\` 标签。
    - 去除版本号。
    
    **4. 图片提取 (Images) - 智能去图标**
    - **重要规则**：网页正文中出现的第一张图片通常是 **插件图标 (Icon)**、**Logo** 或 **作者头像**。
    - **操作**：请**务必跳过**第一张看起来是图标的小图。不要把它加入 \`imageUrls\`。
    - **目标**：只提取 **游戏内截图 (Screenshots)**、**UI 界面展示** 或 **宽屏宣传图**。
    - 如果没有找到任何大图，才勉强使用第一张图，但优先寻找后续的截图。

    **5. 摘要 (Summary)**
    - 80字以内，直接介绍功能。

    如果提供的网页内容为空（即抓取失败），请在 Summary 中说明情况。
  `;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "插件名称 (去除【】标签)" },
      tag: { type: Type.STRING, description: "标签 (优先: 原创, 搬运, 新品。禁止: 付费精选, 插件名)" },
      shortDescription: { type: Type.STRING, description: "一句话吸引人的标语 (15字以内)" },
      price: { type: Type.STRING, description: "价格 (优先提取带 CNY/RMB/$/¥ 的数字，如 '98.00 CNY')" },
      summary: { type: Type.STRING, description: "简介 (80字以内)" },
      features: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "3-4个核心功能点"
      },
      imageUrls: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "图片链接列表 (务必排除插件Icon/Logo/头像，优先展示游戏截图)"
      }
    },
    required: ["name", "tag", "shortDescription", "price", "summary", "features", "imageUrls"]
  };

  try {
    // 2. 使用 Gemini 3.0 Flash Preview 处理内容
    // 注意：Gemini 1.5/3.0 系列对 HTML 理解能力很强，直接给 HTML 往往比 Markdown 丢失更少信息
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: `
      目标 URL: ${url}
      
      以下是该网页的实际内容：
      --- BEGIN CONTENT ---
      ${pageContent}
      --- END CONTENT ---
      
      请生成海报 JSON 数据。
      重要提示：务必仔细检查 HTML 中的侧边栏(Sidebar)或元数据区域(Metadata)，寻找带有 CNY/RMB/$ 的价格信息。
      同时，请忽略网页上的第一张图标(Icon)图片，只提取游戏截图。`,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    });

    const jsonStr = response.text;
    if (!jsonStr) throw new Error("AI 未返回内容");
    
    return extractJson(jsonStr) as PosterData;

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    if (error.status === 429 || (error.message && error.message.includes('429'))) {
         throw new Error("免费版 API 请求太快了。请稍等 10 秒钟再试。");
    }
    
    if (error.status === 404) {
        throw new Error("模型 'gemini-3-flash-preview' 不可用 (404)。请检查您的 API Key 是否支持该模型，或者在 Google AI Studio 中启用它。");
    }

    throw new Error(error.message || "生成失败，请重试。");
  }
};