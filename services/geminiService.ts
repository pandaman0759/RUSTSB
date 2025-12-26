import { GoogleGenAI, Type, Schema } from "@google/genai";
import { PosterData } from "../types";

const extractJson = (text: string): any => {
  try {
    // Attempt to find JSON within code blocks first
    const match = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (match) {
      return JSON.parse(match[1]);
    }
    // Attempt to parse the whole text if no code blocks
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse JSON from Gemini response", e);
    throw new Error("解析 AI 响应失败，请重试。");
  }
};

export const analyzeUrl = async (url: string): Promise<PosterData> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key 缺失，请检查环境变量配置。");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemInstruction = `
    你是一个精通 Rust 游戏（RustSB, Lone Design, uMod 等）的中文营销专家和网页分析师。
    你的任务是分析提供的插件/模组 URL，提取信息以生成海报。
    
    利用 Google Search 工具深入分析该 URL 的页面内容。
    
    请提取或推断以下详细信息（所有文本必须用中文返回）：
    1. 标签 (Tag)：从页面标题或面包屑中提取简短的状态标签，例如“新品”、“热门”、“免费”、“付费”、“VIP”或“Rust插件”。如果找不到特定状态，默认为“Rust插件”。
    2. 插件名称 (Name)：提取完整的插件名称。通常格式为“英文名 - 中文名”或“【英文名·中文名】”。
    3. 简短描述 (Short Description)：一句话的吸引人的标语。
    4. 价格 (Price)：如果免费则写“免费”，否则写具体金额（如 ¥98.00 或 $15.00）。
    5. 简介 (Summary)：主要功能的简洁总结（最多 80 字）。
    6. 核心功能 (Features)：列出 3-4 个关键功能点。
    7. 图片链接 (Image URLs) [优先级最高]：
       - **RustSB 关键规则**：如果分析的是 RustSB 网站，其高清图片 **不会** 直接显示在搜索摘要中。你必须在页面文本中寻找形如 \`attachments/1234/\` 或 \`attachments/1234.png\` 的路径，然后构造完整链接 \`https://rustsb.com/attachments/1234/\`。
       - **LoneDesign 规则**：寻找 \`assets/...\` 或大尺寸 \`webp/jpg\`。
       - **去重与过滤**：**绝对不要**使用网页的小图标(logo/icon)作为第一张图。如果没有找到高质量大图，该字段可以留空数组 \`[]\`，前端会显示上传框。
       - **数量**：尽量返回 2-3 张。
  `;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "插件完整名称" },
      tag: { type: Type.STRING, description: "标签" },
      shortDescription: { type: Type.STRING, description: "一句话标语" },
      price: { type: Type.STRING, description: "价格" },
      summary: { type: Type.STRING, description: "简介" },
      features: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "功能列表"
      },
      imageUrls: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "图片链接列表（如果找不到合适的，请返回空数组）"
      }
    },
    required: ["name", "tag", "shortDescription", "price", "summary", "features", "imageUrls"]
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `分析此链接：${url}。
      特别注意寻找 RustSB 的 attachments 图片链接。
      如果找到的图片看起来像图标（Icon），请不要包含它。
      如果找不到高质量大图，imageUrls 返回 [] 即可。`,
      config: {
        systemInstruction: systemInstruction,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    });

    const jsonStr = response.text;
    if (!jsonStr) {
        throw new Error("AI 未返回任何响应。");
    }
    
    return extractJson(jsonStr) as PosterData;

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "分析网站时发生错误。");
  }
};