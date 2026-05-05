import { GoogleGenAI, Type } from "@google/genai";

let genAI: GoogleGenAI | null = null;

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not defined. AI features will be disabled.");
    return null;
  }
  if (!genAI) {
    genAI = new GoogleGenAI({ apiKey: apiKey.trim() });
  }
  return genAI;
}

export interface DocumentAnalysis {
  documentType: 'Expense' | 'Income' | 'Payroll';
  vendor: string; 
  date: string;
  total: number;
  gst?: number;
  subtotal?: number;
  items?: Array<{ 
    name: string; 
    price: number; 
    category?: string;
    isAsset?: boolean;
    usefulLife?: number;
  }>;
  category: string;
  isAsset: boolean;
  grossAmount?: number; 
  taxWithheld?: number;
  superannuation?: number;
  ytdGrossAmount?: number;
  ytdTaxWithheld?: number;
  notes?: string;
  confidence: 'high' | 'low';
  unclearReason?: string;
}

const documentSchema = {
  type: Type.OBJECT,
  properties: {
    documentType: { 
      type: Type.STRING, 
      enum: ["Expense", "Income", "Payroll"],
      description: "Expense: money spent. Income: money received. Payroll: Wages."
    },
    vendor: { type: Type.STRING },
    date: { type: Type.STRING, description: "YYYY-MM-DD" },
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
          category: { type: Type.STRING },
          source: { 
            type: Type.STRING, 
            enum: ["Business", "Payroll", "Personal"],
            description: "Business (Sole Trader), Payroll (Work/Employee), or Personal."
          },
          isAsset: { type: Type.BOOLEAN },
          usefulLife: { type: Type.NUMBER }
        }
      }
    },
    category: { type: Type.STRING },
    isAsset: { type: Type.BOOLEAN },
    grossAmount: { type: Type.NUMBER },
    taxWithheld: { type: Type.NUMBER },
    superannuation: { type: Type.NUMBER },
    ytdGrossAmount: { type: Type.NUMBER },
    ytdTaxWithheld: { type: Type.NUMBER },
    notes: { type: Type.STRING },
    confidence: { type: Type.STRING, enum: ["high", "low"] },
    unclearReason: { type: Type.STRING }
  },
  required: ["documentType", "vendor", "total", "date", "confidence", "category"]
};

export async function analyzeDocument(base64Image: string, mimeType: string = "image/jpeg"): Promise<DocumentAnalysis | null> {
  try {
    const ai = getAI();
    if (!ai) return null;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: {
        parts: [
          { text: `Analyze this document for an Australian Sole Trader/Tradie with high precision. 
          
          EXTRACTOR RULES:
          1. Detect Document Type: Expense Receipt, Business Income Invoice, or Payroll Pay Slip.
          2. For EXPENSES: Categorise into: [Tools & Equipment, Materials, Fuel & Transport, Insurance, Professional Fees, Office & Admin, Subcontractors, Printing & Stationary, Repairs & Maintenance, Uniforms & PPE, Travel].
          3. ITEM LEVEL EXTRACTION (CRITICAL):
             - Extract line items from the receipt separately (Limit to the first 25 most important items).
             - Classify each item accurately and assign a 'source': 
               * 'Business' for equipment, materials, and services used for the Sole Trader business.
               * 'Payroll' for items required for their employment as a worker (PAYG).
               * 'Personal' for items that are clearly not related to any income generation.
             - If an item is a durable tool, machine, or electronic device and costs >= $300, mark isAsset=true and estimate its 'usefulLife' (e.g., Laptop=3-5y, Power Tool=5-10y, Vehicle=8-15y).
             - Differentiate between 'Materials' (consumables like screws, glue, timber) and 'Tools' (hammers, drills, saw).
          4. For INCOME/PAYROLL: Extract all figures including Gross, Tax Withheld, and YTD totals if present.
          5. ATO COMPLIANCE: Australian tax law requires assets over $300 to be depreciated. Ensure this is flagged properly in the 'items' array.
          6. Fallback: If text is unclear, extract the largest visible total and most prominent vendor name. Default confidence to 'low' if guessing.
          7. Output ONLY raw JSON based on the schema. No markdown formatting or extra text.` },
          { inlineData: { mimeType, data: base64Image } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: documentSchema
      }
    });

    const text = response.text;
    if (text) {
      try {
        // Robust cleaning in case the model returns markdown despite responseMimeType
        const cleaned = text.replace(/```json\s?|```/g, '').trim();
        return JSON.parse(cleaned) as DocumentAnalysis;
      } catch (parseError) {
        console.error("JSON Parse Error at content start:", text.substring(0, 100));
        console.error("JSON Parse Error at content end:", text.substring(text.length - 100));
        throw parseError;
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
}

export async function suggestCategory(vendor: string, categories: string[]): Promise<string | null> {
  try {
    const ai = getAI();
    if (!ai) return null;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Suggest the most appropriate tax category for vendor "${vendor}" from list: ${categories.join(", ")}. Return ONLY the category name.`,
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
    const ai = getAI();
    if (!ai) return "AI is currently unavailable. Please check your API key in settings.";
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: `You are TradieTax AI assistant, an expert Australian accounting mentor.
          Financial Context: ${context}
          Multilingual Support: Detect the user's language and respond in the SAME language as the user. If they ask in Spanish, answer in Spanish. Use appropriate cultural context for accounting terms.
          Formatting: NO asterisks (*). Use Hyphens (-) for lists. Extra line between bullets. Short, simple language matching the user's input.`,
      },
      history: history as any
    });

    const lastMessage = messages[messages.length - 1].content;
    const result = await chat.sendMessage({ message: lastMessage });
    return (result.text || "Sorry, I couldn't process that.").replace(/\*/g, '');
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "I'm having trouble connecting to TradieTax AI. This usually means the API key is missing or invalid in the deployment settings. Please check your configuration.";
  }
}



