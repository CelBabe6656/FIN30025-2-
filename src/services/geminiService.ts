import { GoogleGenAI, Type } from "@google/genai";

let genAI: GoogleGenAI | null = null;

function getAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please set it in your environment variables.");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export interface DocumentAnalysis {
  documentType: 'Expense' | 'Income' | 'Payroll';
  vendor: string; // or Employer
  date: string;
  total: number; // Net amount for PaySlip, inclusive amount for Sales/Expense
  gst?: number;
  subtotal?: number;
  items?: Array<{ name: string; price: number; category?: string }>;
  category: string;
  isAsset: boolean;
  // PaySlip specific
  grossAmount?: number; 
  taxWithheld?: number;
  superannuation?: number;
  notes?: string;
  // New: Confidence and warnings
  confidence: 'high' | 'low';
  unclearReason?: string;
}

const documentSchema = {
  type: Type.OBJECT,
  properties: {
    documentType: { 
      type: Type.STRING, 
      enum: ["Expense", "Income", "Payroll"],
      description: "Expense: money spent. Income: money received from clients (Sales/Invoices). Payroll: Wages from an employer (Pay Slip)."
    },
    vendor: { type: Type.STRING, description: "Vendor name for expenses, Client name for income, or Employer name for payroll documents" },
    date: { type: Type.STRING, description: "Format: YYYY-MM-DD" },
    total: { type: Type.NUMBER, description: "Total amount on document. For Payroll, this is the NET pay." },
    gst: { type: Type.NUMBER, description: "GST amount if applicable." },
    subtotal: { type: Type.NUMBER },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          price: { type: Type.NUMBER },
          category: { type: Type.STRING }
        }
      }
    },
    category: { 
      type: Type.STRING, 
      description: "Match to most relevant Australian tax category from: Tools & Equipment, Materials, Fuel & Transport, Insurance, Professional Fees, Office & Admin, Subcontractors, Printing & Stationary, Repairs & Maintenance, Uniforms & PPE, Travel, Sales, Services, Wages." 
    },
    isAsset: { type: Type.BOOLEAN, description: "True if document represents a tool/equipment over $300 (Depreciable Asset)" },
    grossAmount: { type: Type.NUMBER, description: "For Payroll: Total pay before tax (Gross)." },
    taxWithheld: { type: Type.NUMBER, description: "For Payroll/Income: Total tax withheld (PAYG)." },
    superannuation: { type: Type.NUMBER, description: "For Payroll: Super contribution amount." },
    notes: { type: Type.STRING, description: "Any additional details or itemised breakdowns found." },
    confidence: { type: Type.STRING, enum: ["high", "low"], description: "Use 'low' if document is blurry, cut off, or details are ambiguous." },
    unclearReason: { type: Type.STRING, description: "Reason why the scan might be inaccurate." }
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
            4. For PAYROLL: Use 'Wages' or 'Salary'. Extract Gross Pay and Tax Withheld.
            5. BUNNINGS/RECCIES: If multiple items exist, detect which are 'Tools' (assets if >$300) and which are 'Materials' (consumables).
            6. VENDOR HINTS: 
               - Bunnings/Total Tools/Sydney Tools -> Tools & Equipment or Materials
               - BP/Shell/Ampol/Caltex -> Fuel & Transport
               - Officeworks -> Office & Admin or Printing & Stationary
               - NRMA/Allianz/GIO -> Insurance
               - Woolworths/Coles -> Usually Office & Admin (supplies) or Personal (but default to Office if on work site)
            7. ASSETS: If an item is a durable tool/machine and costs >$300, set isAsset=true.
            8. If image is blurry/ambiguous, set confidence='low' and explain why.` },
            { inlineData: { mimeType, data: base64Image } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: documentSchema
      }
    });

    if (response.text && response.text !== "undefined" && response.text !== "null") {
      try {
        return JSON.parse(response.text) as DocumentAnalysis;
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
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: `You are an Australian tax expert for tradies. 
            Given the vendor name "${vendor}", suggest the most appropriate category from this list: ${categories.join(", ")}. 
            
            HINTS for tradies:
            - Bunnings, Total Tools, Sydney Tools -> Tools & Equipment or Materials
            - BP, Shell, Ampol, Caltex, Puma -> Fuel & Transport
            - Officeworks, Australia Post -> Office & Admin
            - GIO, Allianz, NRMA, Vero -> Insurance
            - Telstra, Optus, Aussie Broadband -> Utility (or Office & Admin)
            - Repco, Supercheap Auto -> Repairs & Maintenance
            
            Return ONLY the category name matching the list exactly.` }
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
    const ai = getAI();
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
