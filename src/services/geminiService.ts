import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ReceiptData {
  vendor: string;
  date: string;
  total: number;
  gst: number;
  subtotal: number;
  items: Array<{ name: string; price: number; category?: string }>;
  category: string;
  isAsset: boolean;
  depreciationRate?: number;
  purchaseYear?: number;
  notes?: string;
}

const receiptSchema = {
  type: Type.OBJECT,
  properties: {
    vendor: { type: Type.STRING },
    date: { type: Type.STRING, description: "Format: YYYY-MM-DD" },
    total: { type: Type.NUMBER },
    gst: { type: Type.NUMBER },
    subtotal: { type: Type.NUMBER },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          price: { type: Type.NUMBER },
          category: { type: Type.STRING, description: "e.g. Tools, Materials, Personal" }
        }
      }
    },
    category: { type: Type.STRING },
    isAsset: { type: Type.BOOLEAN, description: "True if any single item or total is over $300 and likely a tool/equipment" },
    depreciationRate: { type: Type.NUMBER, description: "Depreciation rate per year as a whole number (e.g. 20 for 20%)" },
    purchaseYear: { type: Type.NUMBER, description: "Year of purchase (e.g. 2025)" },
    notes: { type: Type.STRING }
  },
  required: ["vendor", "total", "date"]
};

export async function analyzeReceipt(base64Image: string): Promise<ReceiptData | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: "Extract receipt data for an Australian sole trader. If it's a Bunnings PowerPass invoice, carefully split 'Materials' (consumables) from 'Tools' (assets). Flag anything over $300 as an asset for depreciation." },
            { inlineData: { mimeType: "image/jpeg", data: base64Image } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: receiptSchema
      }
    });

    if (response.text && response.text !== "undefined" && response.text !== "null") {
      try {
        return JSON.parse(response.text) as ReceiptData;
      } catch (e) {
        console.error("Gemini Analysis Parsing Error:", e, "Response text:", response.text);
        return null;
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return null;
  }
}

export async function suggestCategory(vendor: string, categories: string[]): Promise<string | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: `Given the vendor name "${vendor}", suggest the most appropriate category from this list: ${categories.join(", ")}. Return ONLY the category name.` }
          ]
        }
      ],
      config: {
        responseMimeType: "text/plain",
      }
    });

    const category = response.text?.trim();
    if (category && categories.includes(category)) {
      return category;
    }
    return null;
  } catch (error) {
    console.error("Gemini Category Suggestion Error:", error);
    return null;
  }
}

export async function chatWithTradie(messages: Array<{ role: 'user' | 'assistant', content: string }>, context: string): Promise<string> {
  try {
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    const lastMessage = messages[messages.length - 1].content;

    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: `You are TradieTax AI assistant, a friendly and expert Australian accounting mentor for sole traders, tradies, and small business owners.
            
            Financial Context of the current user:
            ${context}
            
            Formatting rules:
            1. NEVER use asterisks (*) for any formatting. No bolding with **, no bullet points with *.
            2. For lists, ALWAYS use bullet points (using a hyphen -). Add an extra empty line between each bullet point so they appear in separate paragraphs. Do NOT use numbers for lists.
            3. Keep all explanations extremely simple and jargon-free. Explain things like you are talking to a mate at a job site. Use plain English and keep it short.
            
            Guidelines:
            1. ONLY mention the user's total income, profit, or specific financial totals if it is directly relevant to the user's specific question. Do not start every answer with "Based on your income...".
            2. If asked about a specific category (e.g., "Can I claim fuel?"), focus on the tax rules for that category rather than reciting their balance sheet.
            3. Use the "Financial Context" to provide specific, data-driven answers only when the user's question relates to their own transactions, GST, km logged, or assets.
            4. Keep your answers brief and easy to read. Move straight to the point.
            5. Answer general questions about Australian tax law, accounting principles, and business finance (e.g., "What are my tax obligations as a sole trader?", "How do I calculate GST?", "What can I claim as a business expense?") without necessarily tying it back to their current totals unless requested.
            6. Maintain a "Tradie-friendly" tone: helpful, professional, and clear.
            7. **CRITICAL**: If a question is highly complex, legal/auditorial in nature, or outside the provided context/general knowledge, you MUST politely advise the user to:
               - Contact a registered tax agent or accountant.
               - Call the ATO (Australian Taxation Office).
               - Visit the official ATO website (ato.gov.au).
            8. Do not offer professional financial or legal advice in a binding capacity; always include a disclaimer for major decisions.`,
      },
      history: history
    });

    const result = await chat.sendMessage({ message: lastMessage });
    // Strip all asterisks from the result just in case
    return (result.text || "Sorry, I couldn't process that.").replace(/\*/g, '');
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "I'm having trouble connecting to my brain right now. Please call an ATO representative or check the ATO website for official guidance.";
  }
}
