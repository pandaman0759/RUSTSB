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
    2. 插件名称 (Name)：保持原名。
    3. 简短描述 (Short Description)：一句话的吸引人的标语。
    4. 价格 (Price)：如果免费则写“免费”，否则写具体金额（如 ¥98.00 或 $15.00）。
    5. 简介 (Summary)：主要功能的简洁总结（最多 80 字）。
    6. 核心功能 (Features)：列出 3-4 个关键功能点。
    7. 图片链接 (Image URLs)：
       - **最高优先级**：提取真实的插件截图。
       - **RustSB 特别规则**：RustSB 的图片链接通常是 \`https://rustsb.com/attachments/xxxx/\` 格式。这是有效的图片地址，**务必提取**。
       - 请仔细检查页面源代码或搜索结果中的图片资源。
       - 至少提供 1 张图片，最好 3 张。
  `;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "插件名称" },
      tag: { type: Type.STRING, description: "标签，如'新品', '更新', 'Rust插件'" },
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
        description: "图片链接列表"
      }
    },
    required: ["name", "tag", "shortDescription", "price", "summary", "features", "imageUrls"]
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `请分析此链接：${url}。务必提取真实的图片链接（特别是 attachments 格式）。`,
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