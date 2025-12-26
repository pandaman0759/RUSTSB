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

// 使用 Jina.ai 将网页转换为 AI 可读的 Markdown
const fetchUrlContent = async (url: string): Promise<string> => {
  try {
    // r.jina.ai 是一个免费服务，能渲染网页并转换为 Markdown
    const response = await fetch(`https://r.jina.ai/${url}`);
    if (!response.ok) {
        // 如果 Jina 失败，尝试用 allorigins 代理获取原始 HTML（兜底）
        const proxyResponse = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
        if(proxyResponse.ok) {
            const html = await proxyResponse.text();
            // 简单的清理，移除脚本和样式
            return html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, "")
                       .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gm, "")
                       .substring(0, 30000); 
        }
        throw new Error("无法抓取网页内容");
    }
    const text = await response.text();
    // 限制长度，防止超出 Token 或包含过多无关评论
    return text.substring(0, 50000); 
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
    1. **阅读**：分析用户提供的网页 Markdown 内容。
    2. **提取**：精准提取插件名称、价格、功能点。
    3. **找图**：在内容中寻找图片链接。
       - **重点**：对于 RustSB 网站，图片通常在 "Attachments" 或链接形式如 \`https://rustsb.com/attachments/...\` 中。
       - 忽略 Logo、头像、表情包等小图。
    
    输出规则：
    - **Tag**: 必须简短（如：新品、热门、免费、付费）。
    - **Price**: 若未提及价格，且页面看起来像资源页，默认为“免费”。
    - **Summary**: 80字以内的吸睛简介。
    - **Features**: 3-4个核心卖点。
    - **ImageUrls**: 必须是真实的图片 URL。如果内容中完全找不到图片，返回空数组 []。
    
    如果提供的网页内容为空（即抓取失败），请在 Summary 中明确说明：“无法自动读取该页面内容，请手动补充信息。”并尽可能根据 URL 猜测名称。
  `;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "插件名称" },
      tag: { type: Type.STRING, description: "标签(如: 新品, 免费, 付费)" },
      shortDescription: { type: Type.STRING, description: "一句话吸引人的标语" },
      price: { type: Type.STRING, description: "价格" },
      summary: { type: Type.STRING, description: "简介 (80字以内)" },
      features: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "3-4个核心功能点"
      },
      imageUrls: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "提取的图片链接"
      }
    },
    required: ["name", "tag", "shortDescription", "price", "summary", "features", "imageUrls"]
  };

  try {
    // 2. 使用 Gemini 3.0 Flash Preview 处理内容
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: `
      目标 URL: ${url}
      
      以下是该网页的实际内容：
      --- BEGIN CONTENT ---
      ${pageContent}
      --- END CONTENT ---
      
      请生成海报 JSON 数据。`,
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