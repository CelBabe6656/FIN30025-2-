import { google } from "@ai-sdk/google";
import { generateText, generateObject } from "ai";
import { z } from "zod";

// Schema for the AI SDK generateObject
const documentSchema = z.object({
  documentType: z.enum(["Expense", "Income", "Payroll"]),
  vendor: z.string(),
  date: z.string().describe("YYYY-MM-DD"),
  total: z.number(),
  gst: z.number().optional(),
  subtotal: z.number().optional(),
  items: z.array(z.object({
    name: z.string(),
    price: z.number(),
    category: z.string().optional(),
    source: z.enum(["Business", "Payroll", "Personal"]).describe("Business (Sole Trader), Payroll (Work/Employee), or Personal."),
    isAsset: z.boolean().optional(),
    usefulLife: z.number().optional()
  })).optional(),
  category: z.string(),
  isAsset: z.boolean(),
  grossAmount: z.number().optional(),
  taxWithheld: z.number().optional(),
  superannuation: z.number().optional(),
  ytdGrossAmount: z.number().optional(),
  ytdTaxWithheld: z.number().optional(),
  notes: z.string().optional(),
  confidence: z.enum(["high", "low"]),
  unclearReason: z.string().optional()
});

export type DocumentAnalysis = z.infer<typeof documentSchema>;

function getGoogleModel() {
  return google('gemini-1.5-flash');
}

export async function analyzeDocument(base64Image: string, mimeType: string = "image/jpeg"): Promise<DocumentAnalysis | null> {
  try {
    const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

    const { object } = await generateObject({
      model: getGoogleModel(),
      schema: documentSchema,
      messages: [
        {
          role: 'user',
          content: [
            { 
              type: 'text', 
              text: `Analyze this document for an Australian Sole Trader/Tradie with high precision. 
            
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
            6. Fallback: If text is unclear, extract the largest visible total and most prominent vendor name. Default confidence to 'low' if guessing.` 
            },
            { 
              type: 'image', 
              image: cleanBase64
            }
          ]
        }
      ]
    });

    return object;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
}

export async function suggestCategory(vendor: string, categories: string[]): Promise<string | null> {
  try {
    const { text } = await generateText({
      model: getGoogleModel(),
      prompt: `Suggest the most appropriate tax category for vendor "${vendor}" from list: ${categories.join(", ")}. Return ONLY the category name.`,
    });

    const category = text.trim();
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
    const { text } = await generateText({
      model: getGoogleModel(),
      system: `You are TradieTax AI assistant, an expert Australian accounting mentor.
          Financial Context: ${context}
          Multilingual Support: Detect the user's language and respond in the SAME language as the user. If they ask in Spanish, answer in Spanish. Use appropriate cultural context for accounting terms.
          Formatting: NO asterisks (*). Use Hyphens (-) for lists. Extra line between bullets. Short, simple language matching the user's input.`,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })) as any,
    });

    return text.replace(/\*/g, '');
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "I'm having trouble connecting to TradieTax AI. This usually means the API key is missing or invalid in the deployment settings. Please check your configuration.";
  }
}
