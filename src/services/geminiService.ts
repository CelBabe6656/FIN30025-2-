import { GoogleGenAI, Type } from "@google/genai";

let genAI: GoogleGenAI | null = null;

function getAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined.");
    }
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
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: [
        {
          parts: [
            { text: `Analyze this document for an Australian Sole Trader/Tradie. 
            
            EXTRACTOR RULES:
            1. Detect if it is an Expense receipt, a Business Income Invoice, or a Payroll Pay Slip.
            2. For EXPENSES: Categorise into one of [Tools & Equipment, Materials, Fuel & Transport, Insurance, Professional Fees, Office & Admin, Subcontractors, Printing & Stationary, Repairs & Maintenance, Uniforms & PPE, Travel].
            3. For INCOME: Use categories like [Sales, Services, Interest, Other].
            4. For PAYROLL: Use 'Wages' or 'Salary'. Extract Gross Pay, Tax Withheld, AND search for Year-To-Date (YTD) totals for Gross and Tax.
            5. BUNNINGS/RECCIES: If multiple items exist, detect which are 'Tools' (isAsset if >$300) and which are 'Materials' (consumables). For assets, estimate usefulLife in years (e.g. laptop 5y, power tool 10y).
            6. ASSETS: If an item is a durable tool/machine and costs >$300, set isAsset=true inside the items array and for the main document.
            7. CRITICAL: NEVER return an empty object or fail. Even if the image is blurry, extract the LARGEST currency figure found as the 'total' and the most prominent text as the 'vendor'. If you can't find a date, use the current date.
            8. Set confidence='low' ONLY if you are truly guessing, but still provide your best estimate for all fields.` },
            { inlineData: { mimeType, data: base64Image } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: documentSchema
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text) as DocumentAnalysis;
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
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: `You are TradieTax AI assistant, an expert Australian accounting mentor.
          Financial Context: ${context}
          Formatting: NO asterisks (*). Use Hyphens (-) for lists. Extra line between bullets. Short, simple English.`,
      },
      history: history as any
    });

    const lastMessage = messages[messages.length - 1].content;
    const result = await chat.sendMessage({ message: lastMessage });
    return (result.text || "Sorry, I couldn't process that.").replace(/\*/g, '');
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "I'm having trouble connecting to AI. Please try again later.";
  }
}



