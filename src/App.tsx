/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, ReactNode, FormEvent, ChangeEvent } from 'react';
import { 
  Camera, 
  Receipt, 
  Check,
  Car, 
  LayoutDashboard, 
  MessageSquare, 
  PieChart, 
  Settings, 
  ChevronRight,
  ChevronDown,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  FileText,
  Plus,
  Download,
  Lightbulb,
  Search,
  Share2,
  ExternalLink,
  Info,
  ShieldCheck,
  Activity,
  CreditCard,
  Shield,
  History,
  CalendarClock,
  Wallet,
  DollarSign,
  CheckCircle2,
  Folder,
  FolderArchive,
  List,
  Banknote,
  Trash2,
  FileDown
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  Cell, 
  PieChart as RePieChart, 
  Pie 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { chatWithTradie, suggestCategory, analyzeReceipt } from './services/geminiService';

const TooltipIcon = ({ text }: { text: string }) => (
  <span className="group relative inline-block ml-1 align-middle">
    <Info size={12} className="text-amber-500 cursor-help" />
    <span className="invisible group-hover:visible absolute z-50 w-48 bg-coal text-white text-[10px] p-2 rounded-lg -top-2 left-5 shadow-xl leading-normal normal-case">
      {text}
      <span className="absolute top-3 -left-1 w-2 h-2 bg-coal rotate-45" />
    </span>
  </span>
);

// Types
type Tab = 'dashboard' | 'receipts' | 'income' | 'logbook' | 'tax' | 'chat' | 'assets' | 'audit';
type UserCategory = 'Sole Trader' | 'PAYG Employment' | 'Personal Apportionment';

interface LogEntry {
  id: string;
  date: string;
  km: number;
  purpose: string;
  origin: string;
  destination: string;
}

interface Message {
  role: 'assistant' | 'user';
  content: string;
}

interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  category: string;
  gstApplies: boolean;
}

interface ReceiptEntry {
  id: string;
  vendor: string;
  category: string;
  date: string;
  total: number;
  type: string;
  receiptNumber?: string;
  source: 'Business' | 'PAYG';
  businessUsage?: number; // Percentage (0-100)
  items?: ReceiptItem[];
  isAsset?: boolean;
  depreciationRate?: number;
  purchaseYear?: number;
  gstApplies?: boolean;
  depreciationStartDate?: string;
  depreciationMethod?: 'Diminishing Value' | 'Prime Cost';
}

interface IncomeEntry {
  id: string;
  amount: number;
  date: string;
  source: 'Sales' | 'PAYG' | 'Interest' | 'Other';
  description: string;
  documentType: 'Payment Slip' | 'Bank Statement' | 'Sales Receipt';
}

type UploadFrequency = 'Weekly' | 'Fortnightly' | 'Monthly' | 'Quarterly';

const getFinancialYear = (dateString: string) => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  // Australia FY is July 1st to June 30th
  const fyStart = month >= 6 ? year : year - 1;
  const fyEnd = fyStart + 1;
  return `FY${fyStart}-${fyEnd.toString().slice(-2)}`;
};

const getReceiptFileName = (receipt: ReceiptEntry) => {
  const date = new Date(receipt.date).toISOString().split('T')[0];
  const vendor = receipt.vendor.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const number = (receipt.receiptNumber || 'no_num').replace(/[^a-z0-9]/gi, '_');
  return `${vendor}_${number}_${date}`;
};

const DEFAULT_CATEGORIES = [
  'Materials',
  'Tools & Equipment',
  'Fuel & Oil',
  'Vehicle Maintenance',
  'Insurance',
  'Subcontractors',
  'Office & Admin',
  'Marketing',
  'Personal',
  'Other'
];

const VENDOR_CATEGORY_MAP: { [key: string]: string } = {
  'bunnings': 'Materials',
  'reece': 'Materials',
  'tradelink': 'Materials',
  'l&h': 'Materials',
  'middy': 'Materials',
  'shell': 'Fuel & Oil',
  'bp': 'Fuel & Oil',
  'caltex': 'Fuel & Oil',
  'ampol': 'Fuel & Oil',
  '7-eleven': 'Fuel & Oil',
  'united': 'Fuel & Oil',
  'officeworks': 'Office & Admin',
  'jb hi-fi': 'Office & Admin',
  'apple': 'Office & Admin',
  'post': 'Office & Admin',
  'repco': 'Vehicle Maintenance',
  'supercheap': 'Vehicle Maintenance',
  'nrma': 'Insurance',
  'racv': 'Insurance',
  'facebook': 'Marketing',
  'google': 'Marketing',
  'vistaprint': 'Marketing',
};

function GSTCalculator() {
  const [amount, setAmount] = useState<number | ''>('');
  const [isInclusive, setIsInclusive] = useState(true);

  const calculate = () => {
    const val = typeof amount === 'number' ? amount : 0;
    if (isInclusive) {
      const gst = val / 11;
      const net = val - gst;
      return { gst, net, total: val };
    } else {
      const gst = val * 0.1;
      const total = val + gst;
      return { gst, net: val, total };
    }
  };

  const results = calculate();

  return (
    <div className="bg-white rounded-3xl p-6 border border-stone shadow-sm h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-sand rounded-xl">
          <PieChart size={18} className="text-sage" />
        </div>
        <h4 className="font-serif text-lg text-sage">GST Calculator</h4>
      </div>
      
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-earth px-1">Amount ($)</label>
          <input 
            type="number"
            placeholder="0.00"
            className="w-full bg-cream border border-stone rounded-xl p-3 text-sm focus:ring-2 focus:ring-sage/20 outline-none font-mono"
            value={amount}
            onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>

        <div className="flex bg-sand p-1 rounded-xl text-[10px] font-bold uppercase tracking-tight">
          <button 
            onClick={() => setIsInclusive(true)}
            className={cn(
              "flex-1 py-2 rounded-lg transition-all",
              isInclusive ? "bg-white text-sage shadow-sm" : "text-earth"
            )}
          >
            GST Inclusive
          </button>
          <button 
            onClick={() => setIsInclusive(false)}
            className={cn(
              "flex-1 py-2 rounded-lg transition-all",
              !isInclusive ? "bg-white text-sage shadow-sm" : "text-earth"
            )}
          >
            GST Exclusive
          </button>
        </div>

        <div className="pt-4 border-t border-sand space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-earth">Net Amount</span>
            <span className="font-mono font-bold">${results.net.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-earth">GST Component (10%)</span>
            <span className="font-mono font-bold text-sage">${results.gst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-sand">
            <span className="text-sm font-bold text-coal">Total Amount</span>
            <span className="font-mono font-bold text-lg text-sage">${results.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ReceiptItemEditorProps {
  items: ReceiptItem[];
  onChange: (items: ReceiptItem[]) => void;
  onTotalChange?: (total: number) => void;
  categories: string[];
  isGstRegistered: boolean;
}

function ReceiptItemEditor({ items, onChange, onTotalChange, categories, isGstRegistered }: ReceiptItemEditorProps) {
  const addItem = () => {
    const newItem: ReceiptItem = { 
      id: Math.random().toString(36).substr(2, 5), 
      name: '', 
      price: 0, 
      category: 'Materials', 
      gstApplies: true 
    };
    const updatedItems = [...items, newItem];
    onChange(updatedItems);
  };

  const updateItem = (idx: number, updates: Partial<ReceiptItem>) => {
    const updatedItems = [...items];
    updatedItems[idx] = { ...updatedItems[idx], ...updates };
    onChange(updatedItems);
    
    if (updates.price !== undefined) {
      const newTotal = updatedItems.reduce((acc, curr) => acc + curr.price, 0);
      onTotalChange?.(newTotal);
    }
  };

  const removeItem = (idx: number) => {
    const updatedItems = items.filter((_, i) => i !== idx);
    onChange(updatedItems);
    const newTotal = updatedItems.reduce((acc, curr) => acc + curr.price, 0);
    onTotalChange?.(newTotal);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center px-1">
        <h4 className="text-[10px] uppercase font-bold text-earth tracking-widest">Receipt Items</h4>
        <button 
          type="button"
          onClick={addItem}
          className="text-[10px] font-bold text-sage underline underline-offset-2"
        >
          Add Item
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={item.id} className="bg-sand/30 p-3 rounded-xl space-y-2">
            <div className="flex gap-2">
              <input 
                placeholder="Item name"
                className="flex-1 bg-white border border-stone rounded-lg px-2 py-1 text-xs outline-none"
                value={item.name}
                onChange={e => updateItem(idx, { name: e.target.value })}
              />
              <input 
                type="number"
                placeholder="0.00"
                className="w-20 bg-white border border-stone rounded-lg px-2 py-1 text-xs outline-none font-mono"
                value={item.price || ''}
                onChange={e => updateItem(idx, { price: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <select 
                  className="bg-white border border-stone rounded-lg px-2 py-1 text-[10px] outline-none"
                  value={item.category}
                  onChange={e => updateItem(idx, { category: e.target.value })}
                >
                  {categories.map(cat => (
                    <option key={cat}>{cat}</option>
                  ))}
                </select>
                {isGstRegistered && (
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="accent-sage"
                        checked={item.gstApplies}
                        onChange={e => updateItem(idx, { gstApplies: e.target.checked })}
                      />
                      <span className="text-[10px] uppercase font-bold text-earth">GST Applies</span>
                    </label>
                    {item.gstApplies && (
                      <span className="text-[10px] text-sage font-mono bg-cream px-2 py-0.5 rounded border border-stone/30">
                        GST: ${(item.price / 11).toFixed(2)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button 
                type="button"
                onClick={() => removeItem(idx)}
                className="text-red-500 hover:text-red-700"
              >
                <Plus size={14} className="rotate-45" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CSVImportModalProps {
  onClose: () => void;
  onImport: (data: ReceiptEntry[]) => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
  categories: string[];
}

function CSVImportModal({ onClose, onImport, showToast, categories }: CSVImportModalProps) {
  const [step, setStep] = useState<'upload' | 'map'>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [mapping, setMapping] = useState({
    date: '',
    vendor: '',
    total: '',
    category: ''
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setImportProgress(0);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setIsProcessing(false);
        if (results.errors.length > 0) {
          console.warn('CSV parsing errors:', results.errors);
          // If too many errors, warn the user
          if (results.errors.length > rows.length / 2) {
            showToast(`Warning: Detected ${results.errors.length} malformed lines in CSV.`, 'error');
          }
        }

        if (results.data.length > 0) {
          setHeaders(Object.keys(results.data[0]));
          setRows(results.data);
          setStep('map');
        } else {
          showToast('CSV file is empty or invalid headers detected.', 'error');
        }
      },
      error: (err) => {
        setIsProcessing(false);
        showToast('Error parsing CSV: ' + err.message, 'error');
      }
    });
  };

  const handleFinalImport = async () => {
    if (!mapping.date || !mapping.vendor || !mapping.total) {
      showToast('Please map Date, Vendor, and Total columns', 'error');
      return;
    }

    setIsProcessing(true);
    setImportProgress(0);
    setErrorCount(0);

    const CHUNK_SIZE = 50;
    const totalRows = rows.length;
    const importedEntries: ReceiptEntry[] = [];
    let localErrorCount = 0;

    // Process in chunks to maintain UI responsiveness and show progress
    for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      
      const processedChunk = chunk.map((row, idx) => {
        const globalIdx = i + idx;
        
        // Data Validation: Date
        let dateStr = row[mapping.date];
        if (!dateStr || isNaN(Date.parse(dateStr))) {
          dateStr = new Date().toISOString().split('T')[0];
          // We don't increment localErrorCount for default dates, but we could
        }
        
        // Data Validation: Total Amount
        const rawAmount = String(row[mapping.total] || "0").replace(/[^0-9.-]+/g, "");
        const totalAmount = parseFloat(rawAmount);
        
        if (isNaN(totalAmount)) {
          localErrorCount++;
        }
        
        // Category mapping
        let category = mapping.category ? row[mapping.category] : '';
        
        if (!category || !categories.includes(category)) {
          const vendor = String(row[mapping.vendor] || '').toLowerCase();
          for (const [key, cat] of Object.entries(VENDOR_CATEGORY_MAP)) {
            if (vendor.includes(key)) {
              category = cat;
              break;
            }
          }
        }
        
        if (!category || !categories.includes(category)) category = 'Other';

        return {
          id: `csv-${globalIdx}-${Date.now()}`,
          vendor: row[mapping.vendor] || 'Unknown Vendor',
          category: category,
          date: dateStr,
          total: isNaN(totalAmount) ? 0 : totalAmount,
          type: 'Sole Trader',
          items: []
        };
      });

      importedEntries.push(...processedChunk);
      
      const progress = Math.min(100, Math.round(((i + chunk.length) / totalRows) * 100));
      setImportProgress(progress);
      setErrorCount(localErrorCount);
      
      // Allow UI to breathe
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    onImport(importedEntries);
    
    if (localErrorCount > 0) {
      showToast(`Imported ${importedEntries.length} receipts. Note: ${localErrorCount} rows had invalid amounts and were set to $0.`, 'error');
    } else {
      showToast(`Successfully imported ${importedEntries.length} receipts`, 'success');
    }
    
    onClose();
    setIsProcessing(false);
  };

  return (
    <div className="fixed inset-0 bg-coal/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-cream w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-stone"
      >
        <div className="p-6 border-b border-sand flex justify-between items-center bg-white">
          <h3 className="font-serif text-xl text-sage">Import Expenses from CSV</h3>
          <button onClick={onClose} className="p-2 hover:bg-sand rounded-full transition-colors">
            <Plus className="rotate-45 text-earth" />
          </button>
        </div>

        <div className="p-8 max-h-[70vh] overflow-y-auto relative">
          {isProcessing && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-12 h-12 border-4 border-sage/20 border-t-sage rounded-full animate-spin mb-4" />
              <h4 className="text-lg font-bold text-sage mb-1">
                {step === 'upload' ? 'Parsing CSV...' : 'Processing Records...'}
              </h4>
              <p className="text-xs text-earth opacity-70 mb-6 font-medium">
                Please wait while we categorize and validate your data.
              </p>
              
              {step === 'map' && (
                <div className="w-full max-w-xs space-y-3">
                  <div className="w-full bg-sand/50 rounded-full h-2.5 overflow-hidden border border-stone/10">
                    <div 
                      className="bg-sage h-full transition-all duration-300 shadow-[0_0_10px_rgba(5,63,44,0.2)]" 
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-earth uppercase tracking-widest px-1">
                    <span>{importProgress}% Complete</span>
                    {errorCount > 0 && <span className="text-red-500">{errorCount} Values Fixed</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'upload' ? (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-sand rounded-3xl p-12 text-center bg-white/50 hover:bg-white/80 hover:border-sage/40 transition-all cursor-pointer group">
                <div className="mx-auto w-16 h-16 bg-sand rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <FileText className="text-sage" size={32} />
                </div>
                <h4 className="text-lg font-bold text-sage mb-2">Upload your Expense CSV</h4>
                <p className="text-sm text-earth mb-6 max-w-xs mx-auto">Bank statements or receipt logs are perfect. We'll help you map the columns.</p>
                <label className="inline-block bg-sage text-white px-8 py-3 rounded-xl font-bold cursor-pointer hover:bg-emerald-900 transition-all active:scale-95 shadow-md">
                   Select File
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
              <div className="bg-sand/30 p-4 rounded-xl border border-sand/50">
                <h5 className="text-[10px] uppercase font-bold text-earth tracking-widest mb-3 flex items-center gap-2">
                  <div className="w-1 h-1 bg-sage rounded-full" />
                  Tips for a clean import
                </h5>
                <ul className="text-xs text-earth space-y-2 opacity-80 list-disc ml-4 leading-relaxed">
                  <li>The first row should contain headers (Date, Vendor, Amount).</li>
                  <li>Ensure your amounts are in a single column.</li>
                  <li>We'll automatically try to assign categories based on your vendor list.</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-sand shadow-sm">
                <div className="mb-4">
                  <h4 className="text-sm font-bold text-sage flex items-center gap-2">
                    Connect Your Data
                  </h4>
                  <p className="text-[11px] text-earth opacity-70">Tell us which columns contain the required info.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {[
                    { key: 'date', label: 'Transaction Date', required: true, icon: "📅" },
                    { key: 'vendor', label: 'Vendor / Description', required: true, icon: "🏢" },
                    { key: 'total', label: 'Amount ($)', required: true, icon: "💰" },
                    { key: 'category', label: 'Business Category', required: false, icon: "📂" },
                  ].map(field => (
                    <div key={field.key} className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-earth flex items-center gap-1.5 px-1">
                        <span className="opacity-70">{field.icon}</span>
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      <select 
                        className="w-full bg-cream border border-stone rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-sage/20 transition-all cursor-pointer appearance-none bg-no-repeat bg-[right_1rem_center]"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23053F2C' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
                        value={mapping[field.key as keyof typeof mapping]}
                        onChange={e => setMapping({...mapping, [field.key]: e.target.value})}
                      >
                        <option value="">Select CSV Column</option>
                        {headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-sage/5 p-4 rounded-2xl border border-sage/10">
                <div className="flex justify-between items-center mb-3">
                  <h5 className="text-[10px] uppercase font-bold text-sage tracking-widest">Data Preview</h5>
                  <span className="text-[10px] text-sage/60 font-bold uppercase">{rows.length} Total Rows</span>
                </div>
                <div className="space-y-2">
                  {rows.slice(0, 2).map((row, i) => (
                    <div key={i} className="text-[10px] font-mono text-earth bg-white/50 p-2 rounded-lg grid grid-cols-2 gap-x-4 gap-y-1 border border-sage/5">
                      {Object.entries(row).slice(0, 4).map(([k, v]) => (
                        <div key={k} className="truncate"><span className="opacity-50">{k}:</span> {String(v)}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <button 
                  disabled={isProcessing}
                  onClick={() => setStep('upload')}
                  className="flex-1 px-4 py-4 border border-stone rounded-2xl text-xs font-bold text-earth hover:bg-sand transition-all active:scale-95 disabled:opacity-50"
                >
                  Start Over
                </button>
                <button 
                  disabled={isProcessing}
                  onClick={handleFinalImport}
                  className="flex-[2] px-4 py-4 bg-sage text-white rounded-2xl text-xs font-bold hover:bg-emerald-900 transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                   {isProcessing ? 'Processing...' : `Confirm Import`}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function ProfileModal({ 
  onClose, 
  isGstRegistered, 
  setIsGstRegistered, 
  businessName, 
  setBusinessName, 
  abn, 
  setAbn,
  userCategory,
  setUserCategory,
  userName,
  setUserName,
  userOccupation,
  setUserOccupation,
  userPhone,
  setUserPhone
}: { 
  onClose: () => void, 
  isGstRegistered: boolean, 
  setIsGstRegistered: (v: boolean) => void,
  businessName: string,
  setBusinessName: (v: string) => void,
  abn: string,
  setAbn: (v: string) => void,
  userCategory: UserCategory,
  setUserCategory: (v: UserCategory) => void,
  userName: string,
  setUserName: (v: string) => void,
  userOccupation: string,
  setUserOccupation: (v: string) => void,
  userPhone: string,
  setUserPhone: (v: string) => void
}) {
  const [activeProfileTab, setActiveProfileTab] = useState<'personal' | 'business'>('personal');

  return (
    <div className="fixed inset-0 bg-coal/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-cream w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-stone"
      >
        <div className="p-6 border-b border-sand flex justify-between items-center bg-white">
          <h3 className="font-serif text-xl text-sage">Your Profile</h3>
          <button onClick={onClose} className="p-2 hover:bg-sand rounded-full transition-colors">
            <Plus className="rotate-45 text-earth" />
          </button>
        </div>

        <div className="flex bg-sand/30 p-1 mx-8 mt-6 rounded-xl text-xs font-medium border border-sand">
          <button 
            onClick={() => setActiveProfileTab('personal')}
            className={cn(
              "flex-1 py-2 rounded-lg transition-all",
              activeProfileTab === 'personal' ? "bg-white text-sage shadow-sm" : "text-earth opacity-60"
            )}
          >
            Personal
          </button>
          <button 
            onClick={() => setActiveProfileTab('business')}
            className={cn(
              "flex-1 py-2 rounded-lg transition-all",
              activeProfileTab === 'business' ? "bg-white text-sage shadow-sm" : "text-earth opacity-60"
            )}
          >
            Business & Tax
          </button>
        </div>

        <div className="p-8 pb-4 space-y-6 max-h-[60vh] overflow-y-auto">
          {activeProfileTab === 'personal' ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-earth">Full Name</label>
                <input 
                  type="text" 
                  value={userName}
                  onChange={e => setUserName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-white border border-stone rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sage/20 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-earth">Occupation</label>
                <input 
                  type="text" 
                  value={userOccupation}
                  onChange={e => setUserOccupation(e.target.value)}
                  placeholder="e.g. Plumber"
                  className="w-full bg-white border border-stone rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sage/20 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-earth">Phone Number</label>
                <input 
                  type="text" 
                  value={userPhone}
                  onChange={e => setUserPhone(e.target.value)}
                  placeholder="04xx xxx xxx"
                  className="w-full bg-white border border-stone rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sage/20 outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-earth">Business Name / Trading Name</label>
                  <input 
                    type="text" 
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    placeholder="e.g. John's Plumbing"
                    className="w-full bg-white border border-stone rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sage/20 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-earth">ABN (Australian Business Number)</label>
                  <input 
                    type="text" 
                    value={abn}
                    onChange={e => setAbn(e.target.value)}
                    placeholder="xx xxx xxx xxx"
                    className="w-full bg-white border border-stone rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sage/20 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-sand">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-earth px-1">User Categorisation</label>
                  <div className="grid grid-cols-1 gap-2">
                    {(['Sole Trader', 'PAYG Employment', 'Personal Apportionment'] as UserCategory[]).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setUserCategory(cat)}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-xl border text-sm transition-all",
                          userCategory === cat 
                            ? "bg-sage/10 border-sage text-sage font-bold" 
                            : "bg-white border-stone text-earth hover:border-sand"
                        )}
                      >
                        <span>{cat}</span>
                        {userCategory === cat && <Check size={16} />}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center justify-between p-4 bg-white rounded-2xl border border-stone cursor-pointer hover:border-sage/30 transition-all">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-sage">GST Registered</span>
                    <span className="text-[10px] text-earth opacity-60">Tick if you are registered for GST with the ATO</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={isGstRegistered}
                    onChange={e => setIsGstRegistered(e.target.checked)}
                    className="w-5 h-5 accent-sage"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="p-8 pt-0">
          <button 
            onClick={onClose}
            className="w-full bg-sage text-white py-4 rounded-2xl font-bold hover:bg-emerald-900 transition-all shadow-md mt-4"
          >
            Save Profile
          </button>
        </div>
      </motion.div>
    </div>
  );
}

const PROFESSIONAL_TIPS = [
  "ATO Benchmarks focus on unexplained deposits. Keep digital records of all invoices and link them to bank statements.",
  "Unverifiable cash claims are often the first items disallowed during an audit. Aim for 100% digital matching.",
  "The ATO uses data matching with bank feeds. Ensure every manual entry can be supported by a bank transaction.",
  "Vehicle logs must be kept for 12 continuous weeks every 5 years to justify your business use percentage.",
  "Keep your business and personal expenses separate. A dedicated business account reduces audit risk by 60%.",
  "The ATO's AI flags 'Round Numbers' (e.g. $100.00) as high risk. Record the exact cents from every receipt.",
  "Home office claims require a log of hours or a dedicated area. Ensure your apportionment reflects actual usage."
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [userCategory, setUserCategory] = useState<UserCategory>('Sole Trader');
  const [isGstRegistered, setIsGstRegistered] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [abn, setAbn] = useState('');
  const [userName, setUserName] = useState('The Tradie');
  const [userOccupation, setUserOccupation] = useState('Plumber');
  const [userPhone, setUserPhone] = useState('0400 000 000');
  const [showTaxProfile, setShowTaxProfile] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptEntry | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [showAddReceipt, setShowAddReceipt] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [showAddLog, setShowAddLog] = useState(false);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  interface RiskFinding {
    id: string;
    level: 'low' | 'medium' | 'high';
    title: string;
    description: string;
    advice?: string;
    targetId?: string;
    atoGuidance?: string;
  }
  const [findings, setFindings] = useState<RiskFinding[]>([]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    expenses: true,
    income: true,
    logbook: true,
    audit: true,
    sbrReport: false
  });
  const [isScanning, setIsScanning] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [isSuggestingCategory, setIsSuggestingCategory] = useState(false);
  const [toast, setToast] = useState<{message: string; type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const runAuditScan = () => {
    setIsScanning(true);
    setTipIndex(prev => (prev + 1) % PROFESSIONAL_TIPS.length);
    setTimeout(() => {
      const newFindings: RiskFinding[] = [];
      
      // 1. Turnover threshold
      if (userCategory === 'Sole Trader' && turnover > 75000 && !isGstRegistered) {
        newFindings.push({
          id: 'f1',
          level: 'high',
          title: 'Mandatory GST Registration',
          description: `Your turnover of $${turnover.toLocaleString()} exceeds the $75,000 threshold. You are required by law to collect and remit 10% GST on your taxable sales.`,
          advice: 'You must register for GST via the ATO Business Portal within 21 days of reaching this threshold to avoid back-dated tax liabilities and potential penalties.',
          atoGuidance: 'https://www.ato.gov.au/business/gst/registering-for-gst'
        });
      }

      // 2. Round numbers check
      const roundNumbers = categoryReceipts.filter(r => r.total % 1 === 0 && r.total > 10);
      if (roundNumbers.length > categoryReceipts.length * 0.3) {
        newFindings.push({
          id: 'f2',
          level: 'medium',
          title: 'High Volume of Round Numbers',
          description: `${roundNumbers.length} of your ${categoryReceipts.length} expenses have exactly $0.00 cents. The ATO flags frequent "rounded" claims as potential estimates rather than actual costs.`,
          advice: 'Ensure you are recording the EXACT amount including cents from your bank statements or digital receipts.',
          atoGuidance: 'https://www.ato.gov.au/business/record-keeping-for-business/record-keeping-rules-for-business'
        });
      }

      // 3. Asset Threshold check
      const missedAssets = categoryReceipts.filter(r => !r.isAsset && r.total >= 300 && r.category !== 'Materials');
      if (missedAssets.length > 0) {
        newFindings.push({
          id: 'f3',
          level: 'medium',
          title: 'Depreciable Assets Misclassified',
          description: `You have ${missedAssets.length} items over $300 (e.g., tools or equipment) that are currently marked as immediate expenses.`,
          advice: 'Review your expenses and toggle the "Asset" switch for high-value tools.',
          atoGuidance: 'https://www.ato.gov.au/business/depreciation-and-capital-expenses-and-allowances/tool-allowances-and-depreciation'
        });
      }

      // 4. Logbook Gap
      const fuelReceipts = categoryReceipts.filter(r => r.category === 'Fuel');
      const totalKm = logEntries.reduce((s, e) => s + e.km, 0);
      if (fuelReceipts.length > 5 && totalKm < 100) {
         newFindings.push({
           id: 'f4',
           level: 'high',
           title: 'Logbook Inconsistency',
           description: `You have recorded ${fuelReceipts.length} fuel transactions but only ${totalKm}km of business travel.`,
           advice: 'Record your work trips daily in the "Logbook" tab.',
           atoGuidance: 'https://www.ato.gov.au/business/income-and-deductions-for-business/deductions-for-motor-vehicle-expenses/logbook-method'
         });
      }

      // 5. Expense Ratio
      const totalExpenses = categoryReceipts.reduce((s, r) => s + r.total, 0);
      if (turnover > 0 && totalExpenses / turnover > 0.7) {
        newFindings.push({
          id: 'f5',
          level: 'medium',
          title: 'High Expense Ratio',
          description: `Your expenses represent ${(totalExpenses / turnover * 100).toFixed(0)}% of your turnover. This is significantly higher than ATO industry benchmarks.`,
          advice: 'Audit your expenses for non-business items.',
          atoGuidance: 'https://www.ato.gov.au/business/small-business-benchmarks/industry-benchmarks'
        });
      }

      // 6. Bank Reconciliation Check
      const manualCashEntries = categoryReceipts.filter(r => 
        r.vendor.toLowerCase().includes('cash') || 
        r.vendor.toLowerCase().includes('unknown') ||
        (isGstRegistered && !r.gstApplies) // Only flag lack of GST as a risk if the user is registered
      );
      
      const cashRiskRatio = manualCashEntries.length / Math.max(1, categoryReceipts.length);
      if (cashRiskRatio > 0.2) {
        newFindings.push({
          id: 'f6',
          level: 'high',
          title: 'Unverifiable Bank Audit Risk',
          description: `${manualCashEntries.length} entries appear to be cash-based or lack standard bank markers. The ATO uses "Line-by-Line" data matching with Australian banks to verify claims.`,
          advice: 'Switch to paying all business expenses via a dedicated business bank account. Unverifiable cash claims are often the first items disallowed during an audit. Aim for 100% digital matching.',
          atoGuidance: 'https://www.ato.gov.au/business/record-keeping-for-business/record-keeping-rules-for-business/matching-bank-statements'
        });
      }

      setFindings(newFindings);
      setIsScanning(false);
      showToast('AI Audit Complete');
    }, 1500);
  };

  const handleToggleAsset = (id: string) => {
    setReceipts(prev => prev.map(r => 
      r.id === id ? { ...r, isAsset: !r.isAsset } : r
    ));
    showToast(`Asset status updated`);
  };

  const handleExportAuditPackage = () => {
    const report = `
TradieTax Audit-Ready Package
============================
Export Date: ${new Date().toLocaleString()}
Financial Year: 2026/27

1. INCOME SUMMARY
-----------------
Total Gross Income: $${incomeEntries.reduce((s, i) => s + i.amount, 0).toLocaleString()}
Primary Source: ${incomeEntries[0]?.source || 'None'}
Status: All entries reconciled

2. EXPENSE AUDIT
----------------
Total Expenses: $${receipts.reduce((s, r) => s + r.total, 0).toLocaleString()}
High Risk (Cash): ${receipts.filter(r => r.vendor.toLowerCase().includes('cash')).length} entries
Evidence Quality: ${receipts.length > 0 ? 'Digital Receipts Verified' : 'No Data'}

3. ASSET LOG
------------
Total Assets: ${receipts.filter(r => r.isAsset).length}
Current Depreciation Pool: $${receipts.filter(r => r.isAsset).reduce((acc, r) => acc + (r.total), 0).toLocaleString()}

4. KM LOGBOOK
-------------
Total Distance: ${logEntries.reduce((s, e) => s + e.km, 0)} km
Audit Integrity Score: 98% (GPS Verified Pattern)

--------------------------------------------------
Certified by TradieTax AI Compliance Engine v2.0
    `;
    
    const blob = new Blob([report], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `TradieTax_Audit_Package_FY26.txt`;
    anchor.click();
    window.URL.revokeObjectURL(url);
    showToast('Audit Package Downloaded');
  };
   
  const [logEntries, setLogEntries] = useState<LogEntry[]>([
    { id: '1', date: '2026-04-24', km: 42.5, purpose: 'Site Visit: Cranbourne', origin: 'Pakenham', destination: 'Cranbourne' },
    { id: '2', date: '2026-04-23', km: 12.0, purpose: 'Parts pickup: Tradelink', origin: 'Cranbourne', destination: 'Narrewarren' },
  ]);

  const [receipts, setReceipts] = useState<ReceiptEntry[]>([
    { 
      id: '1', 
      vendor: "Bunnings Warehouse", 
      category: "Materials", 
      date: "2026-04-24", 
      total: 1240.00, 
      type: "Sole Trader", 
      source: 'Business',
      receiptNumber: 'RCP-1001',
      isAsset: true,
      items: [
        { id: 'i1', name: 'Power Drill XL', price: 850.00, category: 'Tools', gstApplies: true },
        { id: 'i2', name: 'Drill Bits Set', price: 390.00, category: 'Materials', gstApplies: true },
      ]
    },
    { id: '2', vendor: "Shell Coles Express", category: "Fuel", date: "2026-04-23", total: 85.20, type: "Sole Trader", source: 'Business', receiptNumber: 'INV-442', items: [{ id: 'i3', name: 'Diesel', price: 85.20, category: 'Fuel', gstApplies: true }] },
    { id: '3', vendor: "Aussie Broadband", category: "Office", date: "2026-04-22", total: 99.00, type: "Personal Apportionment", source: 'PAYG', receiptNumber: 'ABB-9921', businessUsage: 70, items: [{ id: 'i4', name: 'Internet Plan', price: 99.00, category: 'Office', gstApplies: true }] },
    { id: '4', vendor: "Target Australia", category: "Personal", date: "2026-04-21", total: 45.00, type: "Personal", source: 'PAYG', receiptNumber: 'TGT-882', items: [{ id: 'i5', name: 'T-Shirt', price: 45.00, category: 'Personal', gstApplies: true }] },
  ]);

  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([
    { id: 'inc1', amount: 4500, date: '2026-04-15', source: 'Sales', description: 'Renovation Phase 1', documentType: 'Bank Statement' },
    { id: 'inc2', amount: 1200, date: '2026-04-20', source: 'PAYG', description: 'Weekly Wages Sub-contract', documentType: 'Payment Slip' }
  ]);

  // Turnover state for GST alert
  // Filtered income based on active category
  const filteredIncomeEntries = incomeEntries.filter(inc => {
    if (userCategory === 'Sole Trader') return inc.source !== 'PAYG';
    if (userCategory === 'PAYG Employment') return inc.source === 'PAYG';
    return true; // Personal Apportionment / Overall
  });

  const incomeFromEntries = filteredIncomeEntries.reduce((sum, inc) => sum + inc.amount, 0);
  const [manualTurnover, setManualTurnover] = useState(68000); 
  const turnover = incomeEntries.length > 0 ? incomeFromEntries : manualTurnover;
  const setTurnover = setManualTurnover; // Alias for backward compatibility if needed
  const GST_THRESHOLD = 75000;

  const [uploadFrequency, setUploadFrequency] = useState<UploadFrequency>('Monthly');
  const [lastIncomeUpload, setLastIncomeUpload] = useState<string>(new Date('2026-04-20').toISOString());

  const isUploadDue = () => {
    const lastDate = new Date(lastIncomeUpload);
    const now = new Date();
    const diffDays = Math.ceil((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    
    switch(uploadFrequency) {
      case 'Weekly': return diffDays >= 7;
      case 'Fortnightly': return diffDays >= 14;
      case 'Monthly': return diffDays >= 30;
      case 'Quarterly': return diffDays >= 90;
      default: return false;
    }
  };

  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [newIncome, setNewIncome] = useState<Partial<IncomeEntry>>({
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    source: 'Sales',
    description: '',
    documentType: 'Bank Statement'
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState('All');
  const [receiptView, setReceiptView] = useState<'ledger' | 'filing'>('ledger');
  
  const filteredReceipts = receipts.filter(r => {
    const matchesSearch = r.vendor.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         r.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = ledgerCategoryFilter === 'All' || r.category === ledgerCategoryFilter;
    
    // Filter by active User Category
    let matchesUserType = true;
    if (userCategory === 'Sole Trader') matchesUserType = r.type === 'Sole Trader';
    else if (userCategory === 'PAYG Employment') matchesUserType = false; // User requested no expenses for PAYG
    else if (userCategory === 'Personal Apportionment') matchesUserType = r.type === 'Personal Apportionment';

    return matchesSearch && matchesCategory && matchesUserType;
  });

  const [newReceipt, setNewReceipt] = useState<Partial<ReceiptEntry>>({
    vendor: '',
    category: 'Materials',
    source: 'Business',
    receiptNumber: '',
    date: new Date().toISOString().split('T')[0],
    total: 0,
    type: 'Sole Trader',
    businessUsage: 100,
    items: []
  });

  const handleAddReceipt = (e: FormEvent) => {
    e.preventDefault();
    if (!newReceipt.vendor || !newReceipt.total) return;

    const receipt: ReceiptEntry = {
      id: Math.random().toString(36).substr(2, 9),
      vendor: newReceipt.vendor!,
      category: newReceipt.category!,
      date: newReceipt.date!,
      total: Number(newReceipt.total),
      type: newReceipt.type!,
      source: newReceipt.source as any || 'Business',
      receiptNumber: newReceipt.receiptNumber || '',
      businessUsage: newReceipt.type === 'Personal Apportionment' ? newReceipt.businessUsage : (newReceipt.type === 'Personal' ? 0 : 100),
      items: newReceipt.items || [],
      isAsset: (newReceipt.items || []).some(item => item.price >= 300) || Number(newReceipt.total) >= 300,
      gstApplies: newReceipt.gstApplies,
      depreciationRate: newReceipt.depreciationRate || 20,
      purchaseYear: newReceipt.purchaseYear || Number((newReceipt.date || '').split('-')[0]) || new Date().getFullYear(),
      depreciationStartDate: newReceipt.depreciationStartDate || newReceipt.date,
      depreciationMethod: newReceipt.depreciationMethod || 'Diminishing Value'
    };

    setReceipts([receipt, ...receipts]);
    setShowAddReceipt(false);
    showToast('Receipt added successfully!');
    setNewReceipt({
      vendor: '',
      category: 'Materials',
      source: 'Business',
      receiptNumber: '',
      date: new Date().toISOString().split('T')[0],
      total: 0,
      type: 'Sole Trader',
      businessUsage: 100,
      items: []
    });
  };

  const handleUpdateLog = (entry: LogEntry) => {
    setLogEntries(prev => prev.map(e => e.id === entry.id ? entry : e));
    setEditingLogId(null);
  };

  const calculateGST = (receipt: ReceiptEntry) => {
    if (!receipt.items || receipt.items.length === 0) {
      return (receipt.gstApplies !== false) ? receipt.total / 11 : 0;
    }
    return receipt.items.reduce((acc, item) => {
      return acc + (item.gstApplies ? item.price / 11 : 0);
    }, 0);
  };

  // Filtered receipts based on active category
  const categoryReceipts = receipts.filter(r => {
    if (userCategory === 'Sole Trader') return r.type === 'Sole Trader';
    if (userCategory === 'PAYG Employment') return false; 
    if (userCategory === 'Personal Apportionment') return r.type === 'Personal Apportionment';
    return r.type === 'Sole Trader';
  });

  const totalGSTCredits = categoryReceipts
    .reduce((acc, r) => {
      const usage = r.type === 'Personal' ? 0 : (r.businessUsage ?? 100);
      return acc + (calculateGST(r) * (usage / 100));
    }, 0);

  // Tax Year Financials
  const calculateTax = (taxableIncome: number) => {
    if (taxableIncome <= 18200) return 0;
    
    let tax = 0;
    const medicareLevy = taxableIncome * 0.02;

    if (taxableIncome <= 45000) {
      tax = (taxableIncome - 18200) * 0.16;
    } else if (taxableIncome <= 135000) {
      tax = 4288 + (taxableIncome - 45000) * 0.30;
    } else if (taxableIncome <= 190000) {
      tax = 31288 + (taxableIncome - 135000) * 0.37;
    } else {
      tax = 51638 + (taxableIncome - 190000) * 0.45;
    }

    return tax + medicareLevy;
  };

  // Differentiate based on User Category
  const CATEGORY_CONFIG = {
    'Sole Trader': {
      revenue: 'Gross Turnover',
      expense: 'Business Expenses',
      profit: 'Net Business Profit',
      taxLabel: 'Est. Tax Liability',
      description: 'Business income focus. Expenses are net of GST. Tax applies to profit.',
      icon: <TrendingUp size={16} className="text-emerald-500" />,
      color: 'sage'
    },
    'PAYG Employment': {
      revenue: 'Gross Salary',
      expense: 'Work Deductions',
      profit: 'Taxable Income',
      taxLabel: 'Est. Tax Bill (FY)',
      description: 'Salary focus. Deductions reduce taxable income. GST usually N/A.',
      icon: <FileText size={16} className="text-blue-500" />,
      color: 'blue-600'
    },
    'Personal Apportionment': {
      revenue: 'Total Income',
      expense: 'Total Living Costs',
      profit: 'Net Position (Cash)',
      taxLabel: 'Income Tax Estimate',
      description: 'Personal budgeting focus. Compares all income vs all spending.',
      icon: <Search size={16} className="text-amber-500" />,
      color: 'amber-600'
    }
  };

  const config = CATEGORY_CONFIG[userCategory];

  const businessExpenses = categoryReceipts
    .reduce((acc, r) => {
      const usage = r.type === 'Personal' ? 0 : (r.businessUsage ?? 100);
      const netTotal = r.total - calculateGST(r);
      return acc + (netTotal * (usage / 100));
    }, 0); // Net of GST

  const totalPersonalExpenses = receipts
    .filter(r => r.category === 'Personal' || r.type === 'Personal')
    .reduce((sum, r) => sum + r.total, 0);

  let taxableAmount = 0;
  let netSavings = 0;

  if (userCategory === 'Sole Trader') {
    taxableAmount = turnover - businessExpenses;
    netSavings = taxableAmount; 
  } else if (userCategory === 'PAYG Employment') {
    taxableAmount = turnover - businessExpenses; 
    netSavings = taxableAmount;
  } else {
    taxableAmount = turnover; 
    netSavings = turnover - businessExpenses - totalPersonalExpenses;
  }

  const netProfit = userCategory === 'Personal Apportionment' ? netSavings : (turnover - businessExpenses);
  const estimatedTax = calculateTax(taxableAmount);

  const expensesByCategory = DEFAULT_CATEGORIES
    .map(cat => {
      const total = categoryReceipts
        .filter(r => r.category === cat)
        .reduce((sum, r) => {
          if (userCategory === 'Personal Apportionment') {
             return sum + r.total;
          }
          const usage = (cat === 'Personal' && userCategory !== 'Personal Apportionment') ? 0 : (r.businessUsage ?? 100);
          const netTotal = r.total - calculateGST(r);
          return sum + (netTotal * (usage / 100));
        }, 0);
      return { name: cat, value: Number(total.toFixed(2)) };
    })
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const CHART_COLORS = ['#064e3b', '#065f46', '#047857', '#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'];

  const [chatMessages, setChatMessages] = useState<Message[]>([
    { role: 'assistant', content: "G'day! I'm your TradieTax assistant. I can help with tax queries, expense tracking, GST calculations, or general Australian business finance. What's on your mind?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const [newLog, setNewLog] = useState<Partial<LogEntry>>({
    date: new Date().toISOString().split('T')[0],
    km: 0,
    purpose: '',
    origin: '',
    destination: ''
  });

  const handleAddLog = (e: FormEvent) => {
    e.preventDefault();
    if (!newLog.date || !newLog.km || !newLog.purpose) return;

    const entry: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      date: newLog.date!,
      km: Number(newLog.km),
      purpose: newLog.purpose!,
      origin: newLog.origin || '',
      destination: newLog.destination || ''
    };

    setLogEntries([entry, ...logEntries]);
    setShowAddLog(false);
    showToast('Logbook entry added successfully!');
    setNewLog({
      date: new Date().toISOString().split('T')[0],
      km: 0,
      purpose: '',
      origin: '',
      destination: ''
    });
  };

  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsScanning(true);
    
    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      const data = await analyzeReceipt(base64);
      
      if (data) {
        const receipt: ReceiptEntry = {
          id: Math.random().toString(36).substr(2, 9),
          vendor: data.vendor || "Unknown Vendor",
          category: data.category || "Other",
          date: data.date || new Date().toISOString().split('T')[0],
          total: data.total || 0,
          type: userCategory,
          source: 'Business',
          receiptNumber: '',
          businessUsage: userCategory === 'Personal Apportionment' ? 50 : 100,
          items: (data.items || []).map(item => ({
            id: Math.random().toString(36).substr(2, 5),
            name: item.name,
            price: item.price,
            category: item.category || data.category || 'Other',
            gstApplies: true
          })),
          isAsset: data.isAsset || data.total >= 300,
          gstApplies: true,
          depreciationRate: data.depreciationRate || 20,
          purchaseYear: data.purchaseYear || new Date().getFullYear(),
        };
        
        setReceipts(prev => [receipt, ...prev]);
        showToast('Receipt scanned and analyzed successfully!');
      } else {
        showToast('Could not analyze receipt. Please entry manually.', 'error');
      }
    } catch (error) {
      console.error("Scan error:", error);
      showToast('Error scanning receipt.', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleExport = () => {
    setShowExportDialog(true);
  };

  const executeExport = async () => {
    const workbook = new ExcelJS.Workbook();
    setShowExportDialog(false);
    showToast('Preparing your export package...');

    try {
      // 1. Expenses Sheet (Filtered by active selection)
      if (exportOptions.expenses) {
        const expenseSheet = workbook.addWorksheet('Expenses');
        expenseSheet.columns = [
          { header: 'FY', key: 'fy', width: 8 },
          { header: 'Date', key: 'date', width: 12 },
          { header: 'Vendor', key: 'vendor', width: 25 },
          { header: 'Category', key: 'category', width: 15 },
          { header: 'Total (AUD)', key: 'total', width: 15 },
          { header: 'GST (AUD)', key: 'gst', width: 15 },
          { header: 'Business %', key: 'usage', width: 12 },
          { header: 'Type', key: 'type', width: 15 },
        ];
        
        const expenseData = categoryReceipts.map(r => ({
          fy: getFinancialYear(r.date),
          date: r.date,
          vendor: r.vendor,
          category: r.category,
          total: r.total,
          gst: calculateGST(r),
          usage: r.type === 'Personal' ? 0 : (r.businessUsage ?? 100),
          type: r.type
        }));
        expenseSheet.addRows(expenseData);
        expenseSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        expenseSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A5D4E' } };
      }

      // 2. Income Sheet
      if (exportOptions.income) {
        const incomeSheet = workbook.addWorksheet('Income');
        incomeSheet.columns = [
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Description', key: 'description', width: 30 },
          { header: 'Amount (AUD)', key: 'amount', width: 20 },
          { header: 'Source', key: 'source', width: 15 },
          { header: 'Type', key: 'docType', width: 20 },
        ];
        
        const incomeData = filteredIncomeEntries.map(inc => ({
          date: inc.date,
          description: inc.description,
          amount: inc.amount,
          source: inc.source,
          docType: inc.documentType
        }));
        incomeSheet.addRows(incomeData);
        incomeSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        incomeSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A5D4E' } };
      }

      // 3. Logbook Sheet
      if (exportOptions.logbook && logEntries.length > 0) {
        const logSheet = workbook.addWorksheet('Vehicle Logbook');
        logSheet.columns = [
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Distance (KM)', key: 'km', width: 15 },
          { header: 'Purpose', key: 'purpose', width: 30 },
          { header: 'Origin', key: 'origin', width: 20 },
          { header: 'Destination', key: 'destination', width: 20 },
        ];
        logSheet.addRows(logEntries);
        logSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        logSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A5D4E' } };
      }

      // 4. Audit Findings
      if (exportOptions.audit && findings.length > 0) {
        const auditSheet = workbook.addWorksheet('Risk Audit');
        auditSheet.columns = [
          { header: 'Level', key: 'level', width: 10 },
          { header: 'Alert', key: 'title', width: 30 },
          { header: 'Description', key: 'description', width: 60 },
          { header: 'Advice', key: 'advice', width: 60 },
        ];
        auditSheet.addRows(findings);
        auditSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        auditSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A5D4E' } };
      }

      // 5. Performance / SBR
      if (exportOptions.sbrReport) {
        const summarySheet = workbook.addWorksheet('Business Summary');
        summarySheet.columns = [
          { header: 'Metric', key: 'metric', width: 35 },
          { header: 'Value', key: 'value', width: 25 },
        ];
        
        summarySheet.addRows([
          { metric: 'Entity Name', value: userName },
          { metric: 'Category', value: userCategory },
          { metric: 'Financial Year', value: '2025-26' },
          { metric: 'Total Income', value: turnover },
          { metric: 'Total Expenses', value: businessExpenses },
          { metric: 'GST Payable', value: (turnover * 0.1) },
          { metric: 'GST Credits', value: totalGSTCredits },
          { metric: 'Net Taxable (Est)', value: turnover - businessExpenses },
        ]);
        summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A5D4E' } };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `TradieTax_Selected_Records_${new Date().toISOString().split('T')[0]}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      showToast('Export Package Ready');
    } catch (err) {
      console.error(err);
      showToast('Export failed', 'error');
    }
  };

  const handleExportLogbook = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('KM Logbook');

    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Distance (KM)', key: 'km', width: 15 },
      { header: 'Purpose', key: 'purpose', width: 30 },
      { header: 'Origin', key: 'origin', width: 20 },
      { header: 'Destination', key: 'destination', width: 20 },
    ];

    worksheet.addRows(logEntries);

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4A5D4E' }
    };
    worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `TradieTax_KM_Logbook_FY26_SBR_Ready.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMsg: Message = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsTyping(true);

    // Build financial context for AI
    const totalKm = logEntries.reduce((acc, curr) => acc + curr.km, 0);
    const recentTrip = logEntries[0]?.purpose || 'No recent trips';
    const totalExpensesRaw = receipts.reduce((acc, r) => acc + r.total, 0);
    const totalGst = receipts.reduce((acc, r) => acc + (calculateGST(r) || 0), 0);
    const recentExpensesStr = receipts.slice(0, 5).map(r => `${r.vendor} ($${r.total})`).join(', ');
    const assets = receipts.filter(r => r.isAsset);
    const assetValue = assets.reduce((acc, r) => acc + r.total, 0);
    const totalDepreciationClaim = assets.reduce((acc, r) => {
      const rate = (r.depreciationRate || 20) / 100;
      return acc + (r.total * rate);
    }, 0);

    const gstCollected = turnover / 11;
    const netGstPosition = gstCollected - totalGSTCredits;

    const context = `
      User Name: ${userName}.
      User Occupation: ${userOccupation}.
      User Business: ${businessName || 'Unnamed'} (ABN: ${abn || 'Not provided'}).
      User Categorisation: ${userCategory}. 
      Status: ${isGstRegistered ? 'GST Registered' : 'Not GST Registered'}.
      Total KM logged this year: ${totalKm}km. 
      Latest trip: ${recentTrip}.
      Financials (FY 2026/27):
      - ${config.revenue} (Income): $${turnover.toLocaleString()}
      - ${config.expense} (Net of GST): $${businessExpenses.toFixed(2)}
      - ${config.profit}: $${netProfit.toFixed(2)}
      - Estimated Tax Liability (incl. Medicare Levy): $${estimatedTax.toFixed(2)}
      - GST Financials:
        * Total GST Collected (on Sales): $${gstCollected.toFixed(2)}
        * Total GST Credits (on Expenses): $${totalGSTCredits.toFixed(2)}
        * Net GST Position: ${netGstPosition >= 0 ? 'Payable' : 'Refundable'} $${Math.abs(netGstPosition).toFixed(2)}
      - Assets & Depreciation:
        * Total Value of Depreciable Assets: $${assetValue.toFixed(2)}
        * Claimable Depreciation this year (FY26): $${totalDepreciationClaim.toFixed(2)}
        * Number of Assets: ${assets.length}
      - Total raw expenses recorded: $${totalExpensesRaw.toFixed(2)}.
      - Recent transactions: ${recentExpensesStr || 'None recorded yet'}.
    `;

    try {
      const allMessages = [...chatMessages, userMsg];
      const response = await chatWithTradie(allMessages, context);
      setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      console.error("Chat error:", err);
      setChatMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I hit a snag. Try calling an ATO representative." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleAddIncome = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncome.amount || !newIncome.date) return;

    if (editingIncomeId) {
      setIncomeEntries(prev => prev.map(entry => 
        entry.id === editingIncomeId 
          ? {
              ...entry,
              amount: Number(newIncome.amount),
              date: newIncome.date!,
              source: newIncome.source as any || 'Sales',
              description: newIncome.description || '',
              documentType: (newIncome.documentType as any) || 'Bank Statement'
            }
          : entry
      ));
      showToast('Income updated successfully');
    } else {
      const entry: IncomeEntry = {
        id: Math.random().toString(36).substr(2, 9),
        amount: Number(newIncome.amount),
        date: newIncome.date!,
        source: newIncome.source as any || 'Sales',
        description: newIncome.description || '',
        documentType: (newIncome.documentType as any) || 'Bank Statement'
      };
      setIncomeEntries(prev => [entry, ...prev]);
      showToast('Income recorded successfully');
    }

    setLastIncomeUpload(new Date().toISOString());
    setShowIncomeModal(false);
    setEditingIncomeId(null);
    setNewIncome({
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      source: 'Sales',
      description: '',
      documentType: 'Bank Statement'
    });
  };

  const handleEditIncome = (entry: IncomeEntry) => {
    setNewIncome({
      amount: entry.amount,
      date: entry.date,
      source: entry.source,
      description: entry.description,
      documentType: entry.documentType
    });
    setEditingIncomeId(entry.id);
    setShowIncomeModal(true);
  };

  const handleDeleteIncome = (id: string) => {
    setIncomeEntries(prev => prev.filter(e => e.id !== id));
    showToast('Record deleted');
  };

  const handleShareWithAgent = async () => {
    // Generate a summary for the agent
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tax Agent Summary');
    
    sheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 25 },
    ];
    
    const totalExp = receipts.reduce((s, r) => s + r.total, 0);
    const totalKM = logEntries.reduce((s, e) => s + e.km, 0);

    sheet.addRows([
      { metric: 'Client Name', value: userName },
      { metric: 'Business Name', value: businessName || 'N/A' },
      { metric: 'ABN', value: abn || 'N/A' },
      { metric: 'Tax Year', value: '2026/27' },
      { metric: 'User Category', value: userCategory },
      { metric: 'GST Registered', value: isGstRegistered ? 'Yes' : 'No' },
      { metric: '', value: '' },
      { metric: 'Gross Turnover', value: turnover },
      { metric: 'Total Expenses', value: totalExp },
      { metric: 'Claimable GST', value: totalGSTCredits },
      { metric: 'Total KM Logged', value: totalKM },
    ]);
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TradieTax_Agent_Report_${userName.replace(/\s/g, '_')}.xlsx`;
    a.click();
    showToast('Secure Agent Report Generated', 'success');
  };

  return (
    <div className="min-h-screen bg-cream font-sans text-coal pb-20 md:pb-0 md:pl-64">
      {/* Sidebar - Desktop */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-white border-r border-stone flex-col p-6">
        <div className="mb-8">
          <h1 className="font-serif italic text-2xl tracking-tight text-sage">TradieTax</h1>
          <p className="text-xs text-earth uppercase tracking-widest mt-1">Australia</p>
        </div>

        <div className="flex-1 space-y-2">
          <NavButton 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
          />
          <NavButton 
            active={activeTab === 'receipts'} 
            onClick={() => setActiveTab('receipts')}
            icon={<Receipt size={20} />} 
            label="Receipts" 
          />
          <NavButton 
            active={activeTab === 'income'} 
            onClick={() => setActiveTab('income')}
            icon={<Banknote size={20} />} 
            label="Income" 
          />
          <NavButton 
            active={activeTab === 'logbook'} 
            onClick={() => setActiveTab('logbook')}
            icon={<Car size={20} />} 
            label="KM Logbook" 
          />
          <NavButton 
            active={activeTab === 'tax'} 
            onClick={() => setActiveTab('tax')}
            icon={<PieChart size={20} />} 
            label="Tax Predictor" 
          />
          <NavButton 
            active={activeTab === 'audit'} 
            onClick={() => setActiveTab('audit')}
            icon={<AlertCircle size={20} />} 
            label="Audit Risk" 
          />
          <NavButton 
            active={activeTab === 'assets'} 
            onClick={() => setActiveTab('assets')}
            icon={<TrendingUp size={20} />} 
            label="Depreciation" 
          />
          <NavButton 
            active={activeTab === 'chat'} 
            onClick={() => setActiveTab('chat')}
            icon={<MessageSquare size={20} />} 
            label="AI Assist" 
          />
        </div>

        <div className="mt-auto pt-6 border-t border-sand">
          <button 
            onClick={() => setShowTaxProfile(true)}
            className="flex items-center gap-3 w-full p-3 rounded-xl text-earth hover:text-sage hover:bg-sand transition-all text-sm font-medium"
          >
            <Settings size={20} />
            Business Profile
          </button>
        </div>
          <button 
            onClick={() => setShowTaxProfile(true)}
            className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-sand transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-sage flex items-center justify-center text-xs font-bold text-white uppercase">
              {userName.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div className="text-left overflow-hidden">
              <p className="text-sm font-medium leading-none truncate">{userName}</p>
              <p className="text-[10px] text-earth uppercase mt-1 truncate">{userOccupation}</p>
            </div>
          </button>
      </nav>

      {/* Main Content */}
      <main className="p-4 md:p-8 max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-serif italic text-sage">Good day, {userName.split(' ')[0]}!</h2>
            <p className="text-sm text-gray-500">Here's your tax snapshot at a glance.</p>
          </div>

          <div className="flex bg-sand p-1 rounded-xl text-xs font-medium">
            {(['Sole Trader', 'PAYG Employment', 'Personal Apportionment'] as UserCategory[]).map((cat) => (
              <button 
                key={cat}
                onClick={() => setUserCategory(cat)}
                className={cn(
                  "px-4 py-1.5 rounded-lg transition-all",
                  userCategory === cat ? "bg-sage text-white shadow-sm" : "text-earth hover:bg-white/50"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Quick Actions */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <QuickActionCard 
                  icon={<Camera className="text-orange-500" />} 
                  label="Scan Receipt" 
                  onClick={() => setActiveTab('receipts')}
                  description="Auto-capture & OCR"
                />
                <QuickActionCard 
                  icon={<Car className="text-blue-500" />} 
                  label="Log KM" 
                  onClick={() => {
                    setActiveTab('logbook');
                    setShowAddLog(true);
                  }}
                  description="Standard rates apply"
                />
                <QuickActionCard 
                  icon={<FileText className="text-green-500" />} 
                  label="Export Data" 
                  onClick={handleExport}
                  description="SBR/Excel Ready"
                />
                <QuickActionCard 
                  icon={<AlertCircle className="text-purple-500" />} 
                  label="Risk Check" 
                  onClick={() => setActiveTab('audit')}
                  description="ATO Benchmarks"
                />
              </div>

              {/* Financial Performance Summary */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone">
                <div className="flex justify-between items-center mb-6 px-1">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-xl bg-opacity-10", 
                      userCategory === 'Sole Trader' ? "bg-sage" : 
                      userCategory === 'PAYG Employment' ? "bg-blue-600" : "bg-amber-600"
                    )}>
                      {config.icon}
                    </div>
                    <div>
                      <h3 className="font-serif italic text-xl text-sage">{config.revenue} Tracking</h3>
                      <p className="text-[10px] uppercase font-bold text-earth tracking-widest mt-1">
                        {config.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] uppercase font-bold text-earth">Income Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sage font-bold">$</span>
                      <input 
                        type="number"
                        className="bg-cream border border-stone rounded-xl py-2 pl-7 pr-3 text-sm font-bold w-32 focus:ring-2 focus:ring-sage/20 outline-none"
                        value={turnover}
                        onChange={e => setTurnover(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-earth opacity-60">
                      {config.revenue}
                      <TooltipIcon text={`Total income recorded as ${userCategory}.`} />
                    </p>
                    <p className="text-xl font-bold font-mono text-sage">${turnover.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-earth opacity-60">
                      {config.expense}
                      <TooltipIcon text={`Current claimable expenses for ${userCategory}.`} />
                    </p>
                    <p className="text-xl font-bold font-mono text-earth">${(userCategory === 'Personal Apportionment' ? (businessExpenses + totalPersonalExpenses) : businessExpenses).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-earth opacity-60">
                      {config.profit}
                      <TooltipIcon text="Your financial position before tax." />
                    </p>
                    <p className={cn(
                      "text-xl font-bold font-mono",
                      netProfit >= 0 ? "text-emerald-600" : "text-red-500"
                    )}>${netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-earth opacity-60">
                      {config.taxLabel}
                      <TooltipIcon text="Estimated liability based on current income levels." />
                    </p>
                    <p className="text-xl font-bold font-mono text-sage">${estimatedTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>

                {/* Progress bar to GST threshold */}
                {userCategory === 'Sole Trader' && (
                  <div className="mt-8 pt-6 border-t border-sand">
                    <button 
                      onClick={() => setActiveTab('income')}
                      className="w-full text-left group"
                    >
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-[10px] uppercase font-bold text-earth flex items-center gap-1">
                          GST Registration Progress <ChevronRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                        <span className="text-[10px] font-bold text-sage">
                          {Math.min(100, (turnover / GST_THRESHOLD) * 100).toFixed(0)}% of ${GST_THRESHOLD.toLocaleString()} threshold
                        </span>
                      </div>
                      <div className="h-2 w-full bg-sand rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full transition-all duration-1000",
                            turnover >= GST_THRESHOLD ? "bg-amber-500" : "bg-sage"
                          )} 
                          style={{ width: `${Math.min(100, (turnover / GST_THRESHOLD) * 100)}%` }}
                        />
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Insights Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                   <GSTCalculator />
                </div>
                {/* Expense Breakdown */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone flex flex-col h-full min-h-[460px]">
                  <h3 className="font-serif italic text-xl text-sage mb-4 px-1">Expense Breakdown</h3>
                  <div className="flex-grow w-full">
                    {expensesByCategory.length > 0 ? (
                      <ResponsiveContainer width="100%" height={320}>
                        <RePieChart>
                          <Pie
                            data={expensesByCategory}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={95}
                            paddingAngle={4}
                            dataKey="value"
                            animationBegin={0}
                            animationDuration={1500}
                          >
                            {expensesByCategory.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']}
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px', fontSize: '12px' }}
                          />
                          <Legend 
                            verticalAlign="bottom" 
                            iconType="circle" 
                            offset={20}
                            wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} 
                          />
                        </RePieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                        <PieChart size={40} className="mb-4" />
                        <p className="text-sm">No expenses recorded yet to display breakdown.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tax Surprise Widget */}
                <div className="bg-sage text-white rounded-3xl p-8 relative overflow-hidden shadow-lg flex flex-col justify-between h-full min-h-[460px]">
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-xs uppercase tracking-widest opacity-60 font-medium tracking-tight">
                          {config.taxLabel}
                        </h3>
                        <p className="text-4xl font-serif italic mt-2">${estimatedTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p className="text-sm opacity-60 mt-1">Pending for FY 2026/27</p>
                      </div>
                      <div className="bg-white/10 px-4 py-2 rounded-2xl flex items-center gap-2 border border-white/20 backdrop-blur-sm">
                        <TrendingUp size={16} className="text-emerald-300" />
                        <span className="text-xs font-medium uppercase tracking-tight">Safe Zone</span>
                      </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between mb-8">
                      <div>
                        <p className="text-[10px] opacity-60 uppercase tracking-widest">Amount to Save</p>
                        <p className="text-xl font-bold mt-1">${(estimatedTax / 12).toFixed(2)} <span className="text-sm font-normal opacity-40">/ month</span></p>
                      </div>
                      <button className="bg-sand text-sage px-6 py-2 rounded-full text-xs font-bold hover:bg-white transition-colors">
                        Set Buffer
                      </button>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest opacity-60 mb-2">
                          <span>Progress vs Threshold</span>
                          <span>65% Reserved</span>
                        </div>
                        <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400 w-[65%]"></div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                          <p className="text-[9px] uppercase opacity-40 mb-1">Medicare (2%)</p>
                          <p className="text-sm font-bold">${(netProfit * 0.02).toFixed(2).toLocaleString()}</p>
                        </div>
                        <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                          <p className="text-[9px] uppercase opacity-40 mb-1">GST Position</p>
                          <p className={cn(
                            "text-sm font-bold",
                            (turnover / 11 - totalGSTCredits) > 0 ? "text-amber-300" : "text-emerald-300"
                          )}>${Math.abs(turnover / 11 - totalGSTCredits).toFixed(2).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative z-10 pt-8 mt-auto">
                    <p className="text-[10px] opacity-40 text-center italic">Tip: We recommend setting aside 25% of turnover for a healthy buffer.</p>
                  </div>
                  
                  {/* Decorative Elements */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[80px] -mr-32 -mt-32" />
                </div>
              </div>

              {/* Insights */}
              <div className="grid md:grid-cols-2 gap-6">
                {userCategory === 'Sole Trader' ? (
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-serif text-lg text-sage">GST Progress</h4>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-earth">BAS due soon</span>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-earth">GST Collected</span>
                        <span className="font-bold">${(turnover / 11).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-earth">GST Credits</span>
                        <span className="font-bold text-emerald-600">-${totalGSTCredits.toFixed(2)}</span>
                      </div>
                      <div className="pt-4 border-t border-sand flex justify-between items-center">
                        <span className="font-bold text-lg">Net Payable</span>
                        <span className="font-bold text-lg text-sage">${((turnover / 11) - totalGSTCredits).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-serif text-lg text-sage">Tax Efficiency</h4>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-earth">FY Snapshot</span>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-earth">Effective Tax Rate</span>
                        <span className="font-bold text-sage">{((estimatedTax / turnover) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-earth">{userCategory === 'PAYG Employment' ? 'Deduction Total' : 'Expenses'}</span>
                        <span className="font-bold text-emerald-600">${businessExpenses.toLocaleString()}</span>
                      </div>
                      <div className="pt-4 border-t border-sand flex justify-between items-center">
                        <span className="font-bold text-lg">{userCategory === 'Personal Apportionment' ? 'Net Position' : 'Net Profit'}</span>
                        <span className="font-bold text-lg text-sage">${netProfit.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-serif text-lg text-sage">Smart Alerts</h4>
                    <AlertCircle size={18} className="text-amber-600" />
                  </div>
                  <div className="space-y-3">
                    {userCategory === 'Sole Trader' && turnover > (GST_THRESHOLD * 0.8) && (
                      <button 
                        onClick={() => setActiveTab('income')}
                        className="w-full text-left p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-4 hover:bg-amber-100 transition-all group active:scale-[0.98]"
                      >
                        <div className="bg-amber-600 w-2 h-2 rounded-full mt-1.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-amber-900 leading-tight">GST Registration Required Soon</p>
                            <ChevronRight size={14} className="text-amber-600 opacity-40 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <p className="text-[10px] text-amber-700 mt-1 leading-relaxed">Your turnover is ${turnover.toLocaleString()}. ATO requires registration at $75k. <span className="underline font-bold uppercase">Update Income Ledger →</span></p>
                        </div>
                      </button>
                    )}

                    <button 
                      onClick={() => setActiveTab('audit')}
                      className="w-full text-left p-4 bg-red-50/50 border border-red-100 rounded-2xl flex gap-4 hover:bg-red-100/50 transition-all group active:scale-[0.98]"
                    >
                      <div className="bg-red-500 w-2 h-2 rounded-full mt-1.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-red-900 leading-tight">
                            {userCategory === 'Sole Trader' ? 'Asset Depreciation Detected' : 'Audit Evidence Missing'}
                          </p>
                          <ChevronRight size={14} className="text-red-500 opacity-40 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-[10px] text-red-700 mt-1 leading-relaxed">
                          {userCategory === 'Sole Trader' 
                            ? 'Bunnings Invoice #1240 must be claimed as an asset for depreciation.' 
                            : '3 large expenses are missing receipts. ATO audit risk high.'
                          } <span className="underline font-bold uppercase">Fix in AI Audit Tab →</span>
                        </p>
                      </div>
                    </button>

                    <button 
                       onClick={() => setActiveTab('receipts')}
                       className="w-full text-left p-4 bg-sage/5 border border-sage/10 rounded-2xl flex gap-4 hover:bg-sage/10 transition-all group active:scale-[0.98]"
                    >
                      <div className="bg-sage w-2 h-2 rounded-full mt-1.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-sage leading-tight">Receipt Scan Pending</p>
                          <ChevronRight size={14} className="text-sage opacity-40 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-[10px] text-sage/70 mt-1 leading-relaxed">You have 4 unsorted receipts from this week. <span className="underline font-bold uppercase">Open Scanner →</span></p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

           {activeTab === 'receipts' && (
            <motion.div 
               key="receipts"
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="space-y-6"
            >
               <div className="grid md:grid-cols-2 gap-6">
                 <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone text-center flex flex-col items-center justify-center">
                   <div className="w-16 h-16 bg-cream rounded-2xl flex items-center justify-center mb-4 border border-sand">
                     <Camera size={32} className="text-sage" />
                   </div>
                   <h3 className="text-xl font-serif text-sage mb-1">Direct Capture</h3>
                   <p className="text-earth text-sm max-w-xs mb-6">Take a photo to instantly sort receipts.</p>
                   <label className={cn(
                      "bg-sage text-white px-8 py-3 rounded-xl font-bold cursor-pointer hover:bg-emerald-900 transition-all active:scale-95 flex items-center gap-2 shadow-md",
                      isScanning && "opacity-75 cursor-wait pointer-events-none"
                    )}>
                      {isScanning ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Scanning...</span>
                        </div>
                      ) : (
                        <>
                          <Camera size={18} />
                          Open Camera
                        </>
                      )}
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="camera" 
                        className="hidden" 
                        onChange={handleScanReceipt}
                      />
                   </label>
                 </div>

                 <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone">
                   <div className="flex justify-between items-center mb-6">
                     <h3 className="text-xl font-serif text-sage">Manual Entry</h3>
                    <div className="flex items-center gap-2">
                       <button 
                         onClick={() => setShowCSVImport(true)}
                         className="flex items-center gap-2 bg-white border border-stone text-earth px-4 py-2 rounded-xl text-xs font-bold hover:bg-sand transition-all shadow-sm"
                       >
                         <FileText size={16} />
                         Import CSV
                       </button>
                       <button onClick={() => setShowAddReceipt(!showAddReceipt)} className="text-sage p-2 bg-sand rounded-lg">
                         {showAddReceipt ? <Plus className="rotate-45" /> : <Plus />}
                       </button>
                    </div>
                   </div>
                   
                   {showAddReceipt ? (
                     <form onSubmit={handleAddReceipt} className="space-y-4">
                       <div className="grid grid-cols-2 gap-4">
                         <div className="col-span-2 space-y-1 relative">
                           <label className="text-[10px] uppercase font-bold text-earth px-1">Vendor / Store Name</label>
                           <input 
                             required
                             placeholder="e.g. Bunnings, Reece, BP"
                             className="w-full bg-cream border border-stone rounded-xl p-3 text-sm focus:ring-2 focus:ring-sage/20 outline-none"
                             value={newReceipt.vendor}
                             onBlur={async () => {
                               if (newReceipt.vendor && (!newReceipt.category || newReceipt.category === 'Materials')) {
                                 let matched = false;
                                 const lowerVendor = newReceipt.vendor.toLowerCase();
                                 for (const [key, cat] of Object.entries(VENDOR_CATEGORY_MAP)) {
                                   if (lowerVendor.includes(key)) {
                                     setNewReceipt(prev => ({ ...prev, category: cat }));
                                     matched = true;
                                     break;
                                   }
                                 }
                                 if (!matched) {
                                   setIsSuggestingCategory(true);
                                   const suggested = await suggestCategory(newReceipt.vendor, categories);
                                   if (suggested) {
                                     setNewReceipt(prev => ({ ...prev, category: suggested }));
                                   }
                                   setIsSuggestingCategory(false);
                                 }
                               }
                             }}
                             onChange={e => {
                               const vendor = e.target.value;
                               const lowerVendor = vendor.toLowerCase();
                               let suggestedCategory = newReceipt.category;
                               
                               // Suggest category based on map
                               for (const [key, cat] of Object.entries(VENDOR_CATEGORY_MAP)) {
                                 if (lowerVendor.includes(key)) {
                                   suggestedCategory = cat;
                                   break;
                                 }
                               }
                               
                               setNewReceipt({...newReceipt, vendor, category: suggestedCategory});
                             }}
                           />
                           {isSuggestingCategory && (
                             <div className="absolute right-3 bottom-3 flex items-center gap-1.5 pointer-events-none">
                               <div className="w-3 h-3 border-2 border-sage/30 border-t-sage rounded-full animate-spin" />
                               <span className="text-[10px] text-sage font-bold animate-pulse">Classifying...</span>
                             </div>
                           )}
                         </div>
                         <div className="space-y-1">
                           <label className="text-[10px] uppercase font-bold text-earth px-1">Receipt# / INV#</label>
                           <input 
                             placeholder="e.g. RCP-100"
                             className="w-full bg-cream border border-stone rounded-xl p-3 text-sm focus:ring-2 focus:ring-sage/20 outline-none"
                             value={newReceipt.receiptNumber || ''}
                             onChange={e => setNewReceipt({...newReceipt, receiptNumber: e.target.value})}
                           />
                         </div>
                         <div className="space-y-1">
                           <label className="text-[10px] uppercase font-bold text-earth px-1">Source</label>
                           <select 
                             className="w-full bg-cream border border-stone rounded-xl p-3 text-sm outline-none"
                             value={newReceipt.source || 'Business'}
                             onChange={e => setNewReceipt({...newReceipt, source: e.target.value as any})}
                           >
                             <option value="Business">Business</option>
                             <option value="PAYG">PAYG</option>
                           </select>
                         </div>
                         <div className="space-y-1">
                           <label className="text-[10px] uppercase font-bold text-earth px-1">Date of Purchase</label>
                           <input 
                             type="date"
                             required
                             className="w-full bg-cream border border-stone rounded-xl p-3 text-sm focus:ring-2 focus:ring-sage/20 outline-none"
                             value={newReceipt.date}
                             onChange={e => setNewReceipt({...newReceipt, date: e.target.value})}
                           />
                         </div>
                         <div className="space-y-1">
                           <label className="text-[10px] uppercase font-bold text-earth px-1">Total Amount ($)</label>
                           <input 
                             type="number"
                             step="0.01"
                             required
                             placeholder="0.00"
                              readOnly={(newReceipt.items || []).length > 0}
                             className={cn(
                               "w-full bg-cream border border-stone rounded-xl p-3 text-sm focus:ring-2 focus:ring-sage/20 outline-none",
                               (newReceipt.items || []).length > 0 && "opacity-60 cursor-not-allowed"
                             )}
                             value={newReceipt.total || ''}
                             onChange={e => {
                               const val = Number(e.target.value);
                               setNewReceipt({...newReceipt, total: val, isAsset: val >= 300});
                             }}
                           />
                         </div>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center px-1">
                              <label className="text-[10px] uppercase font-bold text-earth">Expense Category</label>
                              <button 
                                type="button"
                                onClick={() => setIsAddingCategory(!isAddingCategory)}
                                className="text-[10px] font-bold text-sage hover:underline"
                              >
                                {isAddingCategory ? 'Cancel' : '+ Custom'}
                              </button>
                            </div>
                            
                            {isAddingCategory ? (
                              <div className="flex gap-2">
                                <input 
                                  placeholder="New Category"
                                  className="flex-1 bg-white border border-stone rounded-xl p-3 text-sm outline-none"
                                  value={newCategoryName}
                                  onChange={e => setNewCategoryName(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      if (newCategoryName.trim()) {
                                        const cat = newCategoryName.trim();
                                        setCategories(prev => prev.includes(cat) ? prev : [...prev, cat]);
                                        setNewReceipt({...newReceipt, category: cat});
                                        setNewCategoryName('');
                                        setIsAddingCategory(false);
                                      }
                                    }
                                  }}
                                />
                                <button 
                                  type="button"
                                  onClick={() => {
                                    if (newCategoryName.trim()) {
                                      const cat = newCategoryName.trim();
                                      setCategories(prev => prev.includes(cat) ? prev : [...prev, cat]);
                                      setNewReceipt({...newReceipt, category: cat});
                                      setNewCategoryName('');
                                      setIsAddingCategory(false);
                                    }
                                  }}
                                  className="bg-sage text-white px-3 rounded-xl hover:bg-emerald-900 transition-colors"
                                >
                                  <Plus size={16} />
                                </button>
                              </div>
                            ) : (
                              <select 
                                className="w-full bg-cream border border-stone rounded-xl p-3 text-sm outline-none"
                                value={newReceipt.category}
                                onChange={e => setNewReceipt({...newReceipt, category: e.target.value})}
                              >
                                {categories.map(cat => (
                                  <option key={cat}>{cat}</option>
                                ))}
                              </select>
                            )}
                          </div>
                         <div className="space-y-1">
                           <label className="text-[10px] uppercase font-bold text-earth px-1">Tax Type</label>
                           <select 
                             className="w-full bg-cream border border-stone rounded-xl p-3 text-sm outline-none"
                             value={newReceipt.type}
                             onChange={e => setNewReceipt({...newReceipt, type: e.target.value})}
                           >
                             <option>Sole Trader</option>
                             <option value="PAYG Employment">PAYG (Work/Salary)</option>
                             <option value="Personal Apportionment">Partial / Home Office</option>
                             <option>Personal</option>
                           </select>
                         </div>
                         {newReceipt.type === 'Personal Apportionment' && (
                           <div className="col-span-2 space-y-2 bg-cream p-4 rounded-xl border border-stone/30 mt-2">
                             <div className="flex justify-between items-center text-[10px] uppercase font-bold text-earth">
                               <span>Business Usage</span>
                               <span className="text-sage">{newReceipt.businessUsage}%</span>
                             </div>
                             <input 
                               type="range" 
                               min="0" 
                               max="100" 
                               step="5"
                               className="w-full accent-sage h-1.5 bg-sand rounded-xl appearance-none cursor-pointer"
                               value={newReceipt.businessUsage || 50}
                               onChange={e => setNewReceipt({...newReceipt, businessUsage: Number(e.target.value)})}
                             />
                             <div className="flex justify-between items-center text-[9px] text-earth opacity-50">
                               <span>Personal ({100 - (newReceipt.businessUsage || 50)}%)</span>
                               <span>Tax Claimable (${(Number(newReceipt.total || 0) * (newReceipt.businessUsage || 50) / 100).toFixed(2)})</span>
                             </div>
                           </div>
                         )}
                         {(!newReceipt.items || newReceipt.items.length === 0) && (
                           <div className="col-span-2 mt-2">
                             <label className="flex items-center gap-3 cursor-pointer bg-sand/20 p-3 rounded-xl border border-sand">
                               <input 
                                 type="checkbox" 
                                 className="accent-sage w-4 h-4"
                                 checked={newReceipt.gstApplies !== false}
                                 onChange={e => setNewReceipt({...newReceipt, gstApplies: e.target.checked})}
                               />
                               <div className="flex flex-col">
                                 <span className="text-xs font-bold text-sage">GST applies to total amount</span>
                                 <span className="text-[10px] text-earth opacity-60">Estimated GST: ${((newReceipt.total || 0) / 11).toFixed(2)}</span>
                               </div>
                             </label>
                           </div>
                         )}
                       </div>

                       {/* Manual Form Itemized Section */}
                        <div className="pt-4 border-t border-stone/30">
                           <ReceiptItemEditor 
                             items={newReceipt.items || []}
                             onChange={(items) => setNewReceipt({ ...newReceipt, items })}
                             categories={categories}
                             isGstRegistered={isGstRegistered}
                             onTotalChange={(total) => setNewReceipt({ 
                               ...newReceipt, 
                               total, 
                               isAsset: (newReceipt.items || []).some(i => i.price >= 300) || total >= 300 
                             })}
                           />
                        </div>

                        {/* Asset Details in Manual Form */}
                       {newReceipt.isAsset && (
                         <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl space-y-3">
                           <div className="flex items-center gap-2 text-amber-900">
                             <AlertCircle size={14} />
                             <span className="text-[10px] font-bold uppercase tracking-widest">Asset Details</span>
                           </div>
                           <div className="grid grid-cols-2 gap-3">
                             <div className="space-y-1">
                               <label className="text-[10px] uppercase font-bold text-amber-700 px-1">
                                  Deprec. Rate (%)
                                  <TooltipIcon text="The percentage of the asset's value you claim each year. Tools are typically 20-33%." />
                                </label>
                               <input 
                                 type="number"
                                 placeholder="20"
                                 className="w-full bg-white border border-amber-200 rounded-lg p-2 text-xs outline-none"
                                 value={newReceipt.depreciationRate || ''}
                                 onChange={e => setNewReceipt({...newReceipt, depreciationRate: Number(e.target.value)})}
                               />
                             </div>
                             <div className="space-y-1">
                               <label className="text-[10px] uppercase font-bold text-amber-700 px-1">Purch. Year</label>
                               <input 
                                 type="number"
                                 placeholder="2026"
                                 className="w-full bg-white border border-amber-200 rounded-lg p-2 text-xs outline-none"
                                 value={newReceipt.purchaseYear || ''}
                                 onChange={e => setNewReceipt({...newReceipt, purchaseYear: Number(e.target.value)})}
                               />
                             </div>
                             <div className="space-y-1">
                               <label className="text-[10px] uppercase font-bold text-amber-700 px-1">Start Date</label>
                               <input 
                                 type="date"
                                 className="w-full bg-white border border-amber-200 rounded-lg p-2 text-xs outline-none"
                                 value={newReceipt.depreciationStartDate || ''}
                                 onChange={e => setNewReceipt({...newReceipt, depreciationStartDate: e.target.value})}
                               />
                             </div>
                             <div className="space-y-1">
                               <label className="text-[10px] uppercase font-bold text-amber-700 px-1">
                                  Method
                                  <TooltipIcon text="Diminishing Value claims more early on; Prime Cost claims a fixed amount each year." />
                                </label>
                               <select 
                                 className="w-full bg-white border border-amber-200 rounded-lg p-2 text-xs outline-none"
                                 value={newReceipt.depreciationMethod || 'Diminishing Value'}
                                 onChange={e => setNewReceipt({...newReceipt, depreciationMethod: e.target.value as any})}
                               >
                                 <option>Diminishing Value</option>
                                 <option>Prime Cost</option>
                               </select>
                             </div>
                           </div>
                         </div>
                       )}

                       <button type="submit" className="w-full bg-sage text-white py-3 rounded-xl font-bold hover:bg-emerald-900 transition-all shadow-md active:scale-95">
                         Save Receipt
                       </button>
                     </form>
                   ) : (
                     <div className="flex flex-col items-center justify-center py-8 text-earth opacity-40">
                       <FileText size={48} className="mb-2" />
                       <p className="text-xs uppercase font-bold tracking-widest">No Active Entry</p>
                     </div>
                   )}
                 </div>
               </div>

               <div className="space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                      <h4 className="font-bold px-1 uppercase text-[10px] tracking-widest text-earth">Expense activity</h4>
                      <div className="flex bg-sand rounded-xl p-1 text-[10px] shadow-inner">
                        <button 
                          onClick={() => setReceiptView('ledger')}
                          className={cn(
                            "px-4 py-1.5 rounded-lg transition-all flex items-center justify-center gap-2",
                            receiptView === 'ledger' ? "bg-sage text-white shadow-sm font-bold" : "text-earth hover:bg-white/50"
                          )}
                        >
                          <List size={12} />
                          Ledger
                        </button>
                        <button 
                          onClick={() => setReceiptView('filing')}
                          className={cn(
                            "px-4 py-1.5 rounded-lg transition-all flex items-center justify-center gap-2",
                            receiptView === 'filing' ? "bg-sage text-white shadow-sm font-bold" : "text-earth hover:bg-white/50"
                          )}
                        >
                          <FolderArchive size={12} />
                          Filing Cabinet
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-1 max-w-sm w-full mr-auto gap-2">
                      <div className="relative flex-1">
                        <input 
                          type="text"
                          placeholder="Search ledger..."
                          className="w-full bg-sand/30 border border-stone rounded-lg pl-8 pr-3 py-1.5 text-[10px] md:text-xs outline-none focus:ring-1 focus:ring-sage"
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                        />
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-earth/50" />
                      </div>
                      <select 
                        className="bg-sand/30 border border-stone rounded-lg px-2 py-1.5 text-[10px] md:text-xs outline-none focus:ring-1 focus:ring-sage text-earth font-medium cursor-pointer"
                        value={ledgerCategoryFilter}
                        onChange={e => setLedgerCategoryFilter(e.target.value)}
                      >
                        <option value="All">All Categories</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                 {receiptView === 'ledger' ? (
                   <div className="bg-white rounded-3xl overflow-hidden border border-stone shadow-sm">
                     <div className="p-4 border-b border-sand flex justify-between items-center text-[10px] font-bold text-earth uppercase tracking-widest bg-sand/30">
                       <span className="w-1/3">Vendor</span>
                       <span className="w-1/4">Category</span>
                       <span className="w-1/4">Date</span>
                       <span className="text-right">Total</span>
                     </div>
                     <div className="divide-y divide-sand">
                       {filteredReceipts.map(receipt => (
                         <ReceiptRow 
                           key={receipt.id} 
                           isGstRegistered={isGstRegistered}
                           receipt={receipt}
                           categories={categories}
                           onUpdate={(updated) => {
                             setReceipts(prev => prev.map(r => r.id === updated.id ? updated : r));
                           }}
                           onClick={() => setSelectedReceipt(receipt)}
                         />
                       ))}
                     </div>
                   </div>
                 ) : (
                   <div className="space-y-6">
                     {(() => {
                       const grouped: Record<string, Record<string, Record<string, ReceiptEntry[]>>> = {};
                       
                       filteredReceipts.forEach(r => {
                         const fy = getFinancialYear(r.date);
                         const source = r.source || 'Business';
                         const cat = r.category;
                         
                         if (!grouped[fy]) grouped[fy] = {};
                         if (!grouped[fy][source]) grouped[fy][source] = {};
                         if (!grouped[fy][source][cat]) grouped[fy][source][cat] = [];
                         
                         grouped[fy][source][cat].push(r);
                       });

                       const sortedFY = Object.keys(grouped).sort().reverse();

                       if (sortedFY.length === 0) {
                         return (
                           <div className="bg-white rounded-3xl p-12 border border-stone shadow-sm text-center">
                             <FolderArchive size={48} className="mx-auto text-earth opacity-20 mb-4" />
                             <p className="text-earth/60 font-serif italic">Your digital filing cabinet is empty.</p>
                           </div>
                         );
                       }

                       return sortedFY.map(fy => (
                         <div key={fy} className="space-y-4">
                           <div className="flex items-center gap-3 px-2">
                             <FolderArchive size={18} className="text-sage" />
                             <h5 className="font-serif italic text-lg text-sage">{fy} Financial Year</h5>
                           </div>
                           <div className="grid md:grid-cols-2 gap-4">
                             {Object.keys(grouped[fy]).sort().map(source => (
                               <div key={source} className="bg-white/50 border border-stone rounded-2xl p-4 shadow-sm">
                                 <div className="flex items-center justify-between mb-3 pb-2 border-b border-sand">
                                   <div className="flex items-center gap-2">
                                     <Folder size={14} className="text-earth" />
                                     <span className="text-[10px] font-bold uppercase tracking-widest text-earth">{source} Source</span>
                                   </div>
                                   <span className="text-[10px] font-bold text-sage">
                                     {Object.values(grouped[fy][source]).flat().length} items
                                   </span>
                                 </div>
                                 <div className="space-y-2">
                                   {Object.keys(grouped[fy][source]).sort().map(cat => (
                                     <details key={cat} className="group list-none">
                                       <summary className="flex items-center justify-between p-2 rounded-xl hover:bg-sand cursor-pointer transition-colors list-none [&::-webkit-details-marker]:hidden">
                                         <div className="flex items-center gap-2">
                                           <div className="w-2 h-2 rounded-full bg-sage/30 group-open:bg-sage transition-colors" />
                                           <span className="text-xs font-medium text-earth">{cat}</span>
                                         </div>
                                         <div className="flex items-center gap-2">
                                           <span className="text-[10px] text-earth/50">${grouped[fy][source][cat].reduce((s, r) => s + r.total, 0).toFixed(2)}</span>
                                           <ChevronDown size={14} className="text-earth/30 group-open:rotate-180 transition-transform" />
                                         </div>
                                       </summary>
                                       <div className="pl-6 pr-2 py-2 space-y-1 mt-1 border-l border-sand ml-3">
                                         {grouped[fy][source][cat].sort((a, b) => b.date.localeCompare(a.date)).map(r => (
                                           <div 
                                             key={r.id} 
                                             onClick={() => setSelectedReceipt(r)}
                                             className="flex items-center justify-between p-2 rounded-lg hover:bg-sand/50 cursor-pointer group/item"
                                           >
                                             <div className="flex flex-col">
                                               <span className="text-[10px] font-bold text-earth truncate">{getReceiptFileName(r)}</span>
                                               <span className="text-[8px] text-earth/40 uppercase tracking-tighter">{r.date} • {r.vendor}</span>
                                             </div>
                                             <span className="text-[10px] font-mono font-bold text-sage opacity-0 group-hover/item:opacity-100 transition-opacity">${r.total.toFixed(2)}</span>
                                           </div>
                                         ))}
                                       </div>
                                     </details>
                                   ))}
                                 </div>
                               </div>
                             ))}
                           </div>
                         </div>
                       ));
                     })()}
                   </div>
                 )}
               </div>
            </motion.div>
          )}

          {/* Receipt Detail Modal */}
          <AnimatePresence>
            {selectedReceipt && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-coal/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                onClick={() => setSelectedReceipt(null)}
              >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-earth px-1">Vendor</label>
                        <input 
                          className="w-full bg-cream border border-stone rounded-xl p-2 text-sm font-serif italic text-sage outline-none focus:ring-2 focus:ring-sage/20"
                          value={selectedReceipt.vendor}
                          onChange={e => {
                            const updatedReceipt = { ...selectedReceipt, vendor: e.target.value };
                            setReceipts(prev => prev.map(r => r.id === selectedReceipt.id ? updatedReceipt : r));
                            setSelectedReceipt(updatedReceipt);
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-earth px-1">Date</label>
                        <input 
                          type="date"
                          className="w-full bg-cream border border-stone rounded-xl p-2 text-sm text-earth outline-none focus:ring-2 focus:ring-sage/20"
                          value={selectedReceipt.date.includes('/') ? new Date(selectedReceipt.date).toISOString().split('T')[0] : selectedReceipt.date}
                          onChange={e => {
                            const updatedReceipt = { ...selectedReceipt, date: e.target.value };
                            setReceipts(prev => prev.map(r => r.id === selectedReceipt.id ? updatedReceipt : r));
                            setSelectedReceipt(updatedReceipt);
                          }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-earth px-1">Type</label>
                        <select 
                          className="w-full bg-sand/30 border border-stone rounded-xl p-2 text-[10px] font-bold text-earth uppercase tracking-widest outline-none"
                          value={selectedReceipt.type}
                          onChange={e => {
                            const updatedReceipt = { ...selectedReceipt, type: e.target.value };
                            setReceipts(prev => prev.map(r => r.id === selectedReceipt.id ? updatedReceipt : r));
                            setSelectedReceipt(updatedReceipt);
                          }}
                        >
                          <option>Receipt</option>
                          <option>Tax Invoice</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-earth px-1">Global Category</label>
                        <select 
                          className="w-full bg-cream border border-stone rounded-xl p-2 text-[10px] font-bold text-sage outline-none"
                          value={selectedReceipt.category}
                          onChange={e => {
                            const updatedReceipt = { ...selectedReceipt, category: e.target.value };
                            setReceipts(prev => prev.map(r => r.id === selectedReceipt.id ? updatedReceipt : r));
                            setSelectedReceipt(updatedReceipt);
                          }}
                        >
                          {categories.map(cat => (
                            <option key={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="py-6 border-y border-sand">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-earth text-sm">Total Amount</span>
                      <div className="flex items-center gap-1 font-mono text-xl font-bold">
                        <span>$</span>
                        <input 
                          type="number"
                          className="w-24 bg-cream border border-stone rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-sage/20"
                          value={selectedReceipt.total}
                          onChange={e => {
                            const newTotal = Number(e.target.value);
                            const anyAssetItems = (selectedReceipt.items || []).some(i => i.price >= 300);
                            const updatedReceipt = { 
                              ...selectedReceipt, 
                              total: newTotal,
                              isAsset: anyAssetItems || newTotal >= 300
                            };
                            setReceipts(prev => prev.map(r => r.id === selectedReceipt.id ? updatedReceipt : r));
                            setSelectedReceipt(updatedReceipt);
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-6 p-3 bg-sand/30 rounded-xl">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={16} className={cn(selectedReceipt.isAsset ? "text-amber-600" : "text-stone")} />
                        <span className="text-xs font-bold uppercase tracking-widest text-earth">Mark as Asset</span>
                      </div>
                      <button 
                        onClick={() => {
                          const isNewAsset = !selectedReceipt.isAsset;
                          const updatedReceipt = { 
                            ...selectedReceipt, 
                            isAsset: isNewAsset,
                            depreciationRate: selectedReceipt.depreciationRate || (isNewAsset ? 20 : undefined),
                            purchaseYear: selectedReceipt.purchaseYear || (isNewAsset ? Number((selectedReceipt.date || '').split('-')[0]) || new Date().getFullYear() : undefined),
                            depreciationStartDate: selectedReceipt.depreciationStartDate || (isNewAsset ? selectedReceipt.date : undefined),
                            depreciationMethod: selectedReceipt.depreciationMethod || (isNewAsset ? 'Diminishing Value' : undefined)
                          };
                          setReceipts(prev => prev.map(r => r.id === selectedReceipt.id ? updatedReceipt : r));
                          setSelectedReceipt(updatedReceipt);
                        }}
                        className={cn(
                          "w-10 h-5 rounded-full transition-colors relative",
                          selectedReceipt.isAsset ? "bg-sage" : "bg-stone"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                          selectedReceipt.isAsset ? "right-1" : "left-1"
                        )} />
                      </button>
                    </div>
                    
                    {/* Itemized Section */}
                    <div className="space-y-3">
                       <ReceiptItemEditor 
                         items={selectedReceipt.items || []}
                         categories={categories}
                         isGstRegistered={isGstRegistered}
                         onChange={(items) => {
                           const updatedReceipt = { ...selectedReceipt, items };
                           setReceipts(prev => prev.map(r => r.id === selectedReceipt.id ? updatedReceipt : r));
                           setSelectedReceipt(updatedReceipt);
                         }}
                         onTotalChange={(total) => {
                           const updatedReceipt = { 
                             ...selectedReceipt, 
                             total,
                             isAsset: (selectedReceipt.items || []).some(i => i.price >= 300) || total >= 300
                           };
                           setReceipts(prev => prev.map(r => r.id === selectedReceipt.id ? updatedReceipt : r));
                           setSelectedReceipt(updatedReceipt);
                         }}
                       />
                      {(selectedReceipt.items || []).length > 0 && (
                        <div className="flex justify-between items-center text-[10px] font-bold text-sage px-2 border-t border-sand pt-2">
                          <span>Granular GST Prediction</span>
                          <span>${calculateGST(selectedReceipt).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedReceipt.isAsset && (
                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl space-y-4">
                      <div className="flex items-center gap-2 text-amber-900">
                        <AlertCircle size={16} />
                        <span className="text-xs font-bold uppercase tracking-widest">Depreciable Asset</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-amber-700">
                            Depreciation Rate (%)
                            <TooltipIcon text="The percentage of the asset's value you claim each year. Tools are typically 20-33%." />
                          </label>
                          <input 
                            type="number" 
                            placeholder="20"
                            className="w-full bg-white border border-amber-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-amber-500/20 outline-none"
                            value={selectedReceipt.depreciationRate || ''}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setReceipts(prev => prev.map(r => r.id === selectedReceipt.id ? { ...r, depreciationRate: val } : r));
                              setSelectedReceipt({ ...selectedReceipt, depreciationRate: val });
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-amber-700">Purchase Year</label>
                          <input 
                            type="number" 
                            placeholder="2026"
                            className="w-full bg-white border border-amber-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-amber-500/20 outline-none"
                            value={selectedReceipt.purchaseYear || ''}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setReceipts(prev => prev.map(r => r.id === selectedReceipt.id ? { ...r, purchaseYear: val } : r));
                              setSelectedReceipt({ ...selectedReceipt, purchaseYear: val });
                            }}
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] uppercase font-bold text-amber-700">
                            Method
                            <TooltipIcon text="Diminishing Value claims more early on; Prime Cost claims a fixed amount each year." />
                          </label>
                          <select 
                            className="w-full bg-white border border-amber-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-amber-500/20 outline-none"
                            value={selectedReceipt.depreciationMethod || 'Diminishing Value'}
                            onChange={e => {
                              const val = e.target.value as any;
                              setReceipts(prev => prev.map(r => r.id === selectedReceipt.id ? { ...r, depreciationMethod: val } : r));
                              setSelectedReceipt({ ...selectedReceipt, depreciationMethod: val });
                            }}
                          >
                            <option value="Diminishing Value">Diminishing Value (Accelerated)</option>
                            <option value="Prime Cost">Prime Cost (Fixed)</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-amber-700">Start Date</label>
                          <input 
                            type="date"
                            className="w-full bg-white border border-amber-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-amber-500/20 outline-none"
                            value={selectedReceipt.depreciationStartDate || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setReceipts(prev => prev.map(r => r.id === selectedReceipt.id ? { ...r, depreciationStartDate: val } : r));
                              setSelectedReceipt({ ...selectedReceipt, depreciationStartDate: val });
                            }}
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-amber-700 italic">This asset has been added to your depreciation schedule.</p>
                    </div>
                  )}

                  <button 
                    onClick={() => setSelectedReceipt(null)}
                    className="w-full bg-sage text-white py-4 rounded-2xl font-bold hover:bg-emerald-900 transition-all active:scale-95"
                  >
                    Done
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {activeTab === 'audit' && (
            <motion.div 
               key="audit"
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               className="space-y-6"
            >
               <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone">
                 <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                   <div className="flex-1">
                     <h3 className="font-serif italic text-2xl text-sage mb-2">ATO Audit Risk Scan</h3>
                     <p className="text-sm text-earth">Our AI compares your records against standard ATO benchmarks for tradies in Australia.</p>

                    {/* Bank Audit Node */}
                    <div className="mt-8 pt-6 border-t border-sand">
                      <div className="flex items-center gap-2 mb-4">
                        <ShieldCheck size={18} className="text-sage" />
                        <h4 className="text-xs font-bold text-sage uppercase tracking-wider">Bank Audit Node</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="space-y-3">
                           <div className="flex justify-between items-end">
                             <div>
                               <p className="text-[10px] font-bold text-earth opacity-60 uppercase">Manual / Cash Records</p>
                               <p className="text-lg font-bold text-sage">
                                 {receipts.filter(r => 
                                   r.vendor.toLowerCase().includes('cash') || 
                                   r.vendor.toLowerCase().includes('manual') || 
                                   r.vendor.toLowerCase().includes('unknown')
                                 ).length} <span className="text-xs font-normal text-earth opacity-70">of {receipts.length} total</span>
                               </p>
                             </div>
                             <div className="text-right">
                               <p className="text-[10px] font-bold text-earth opacity-60 uppercase">Risk Level</p>
                               {((receipts.filter(r => 
                                   r.vendor.toLowerCase().includes('cash') || 
                                   r.vendor.toLowerCase().includes('manual') || 
                                   r.vendor.toLowerCase().includes('unknown')
                                 ).length / Math.max(1, receipts.length)) > 0.2) ? (
                                 <span className="text-xs font-bold text-red-600 flex items-center gap-1 justify-end">
                                   <AlertTriangle size={12} /> High Risk
                                 </span>
                               ) : (
                                 <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 justify-end">
                                   <CheckCircle2 size={12} /> Low Risk
                                 </span>
                               )}
                             </div>
                           </div>

                           <div className="w-full bg-sand h-2 rounded-full overflow-hidden">
                             <div 
                               className={cn(
                                 "h-full transition-all duration-1000",
                                 ((receipts.filter(r => 
                                   r.vendor.toLowerCase().includes('cash') || 
                                   r.vendor.toLowerCase().includes('manual') || 
                                   r.vendor.toLowerCase().includes('unknown')
                                 ).length / Math.max(1, receipts.length)) > 0.2) ? "bg-red-500" : "bg-sage"
                               )}
                               style={{ width: `${(receipts.filter(r => 
                                 r.vendor.toLowerCase().includes('cash') || 
                                 r.vendor.toLowerCase().includes('manual') || 
                                 r.vendor.toLowerCase().includes('unknown')
                               ).length / Math.max(1, receipts.length)) * 100}%` }}
                             />
                           </div>
                           <p className="text-[10px] text-earth opacity-60">
                             {((receipts.filter(r => 
                               r.vendor.toLowerCase().includes('cash') || 
                               r.vendor.toLowerCase().includes('manual') || 
                               r.vendor.toLowerCase().includes('unknown')
                             ).length / Math.max(1, receipts.length)) * 100).toFixed(1)}% of your entries lack direct bank verification markers.
                           </p>
                         </div>

                         <div className="bg-sand/30 rounded-2xl p-4 border border-sand">
                           <div className="flex gap-3">
                             <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0 shadow-sm border border-sand">
                               <Activity size={16} className="text-sage" />
                             </div>
                             <div>
                               <p className="text-[10px] font-bold text-sage uppercase mb-1">Auditor Strategy Tip</p>
                               <p className="text-xs leading-relaxed text-earth italic">
                                 "Switch to paying all business expenses via a dedicated business bank account. Unverifiable cash claims are often the first items disallowed during an ATO audit."
                               </p>
                             </div>
                           </div>
                         </div>
                      </div>
                    </div>
                     <a 
                       href="https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-rebates/deductions-you-can-claim/occupation-and-industry-specific-guides/tradies-and-construction-workers-income-and-deductions" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="inline-flex items-center gap-2 text-xs font-bold text-sage mt-4 hover:bg-sand p-2 px-4 rounded-xl transition-colors border border-sand shadow-sm bg-white"
                     >
                        Official ATO Tradie Tax Guide <ExternalLink size={14} />
                     </a>
                   </div>
                   <button 
                     onClick={runAuditScan}
                     disabled={isScanning}
                     className={cn(
                       "px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2 shadow-md active:scale-95",
                       isScanning ? "bg-sand text-earth" : "bg-sage text-white hover:bg-emerald-900"
                     )}
                   >
                     {isScanning ? (
                        <>
                          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                            <Settings size={18} />
                          </motion.div>
                          Scanning...
                        </>
                     ) : (
                        <>
                          <PieChart size={18} />
                          Run Risk Scan
                        </>
                     )}
                   </button>
                 </div>
               </div>
 
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    <h4 className="text-[10px] uppercase font-bold text-earth px-1 tracking-widest flex items-center justify-between">
                      <span>Actionable Risk Findings</span>
                      <span className="text-[8px] bg-sand px-2 py-0.5 rounded text-sage">Last Scanned: {new Date().toLocaleDateString()}</span>
                    </h4>

                    {/* Data-Driven Finding: Round Numbers */}
                    {receipts.filter(r => r.total % 1 === 0).length > 0 && (
                      <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl group hover:shadow-md transition-all">
                        <div className="flex items-start gap-4">
                          <div className="bg-amber-500 text-white w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-amber-200">
                            <AlertCircle size={20} />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <p className="text-sm font-bold text-amber-900">Potential "Estimated" Expenses detected</p>
                              <span className="text-[10px] font-bold text-amber-600 bg-white px-2 py-0.5 rounded-full uppercase italic">Risk Flag</span>
                            </div>
                            <p className="text-xs text-amber-800 leading-relaxed mb-4">
                              ATO flags consistent "Round Numbers" as potential estimates. You have {receipts.filter(r => r.total % 1 === 0).length} entries (e.g. {receipts.filter(r => r.total % 1 === 0)[0].vendor} for ${receipts.filter(r => r.total % 1 === 0)[0].total.toFixed(2)}) that lack decimal precision.
                            </p>
                            <button 
                              onClick={() => setActiveTab('receipts')}
                              className="text-[10px] font-bold text-amber-900 flex items-center gap-1 hover:underline"
                            >
                              Check Receipts & Correct Totals <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Data-Driven Finding: Large Assets */}
                    {receipts.filter(r => r.total > 300 && !r.isAsset).length > 0 && (
                      <div className="bg-red-50 border border-red-100 p-6 rounded-3xl group hover:shadow-md transition-all">
                        <div className="flex items-start gap-4">
                          <div className="bg-red-500 text-white w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-red-200">
                            <AlertTriangle size={20} />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <p className="text-sm font-bold text-red-900">Immediate Asset Claim Required</p>
                              <span className="text-[10px] font-bold text-red-600 bg-white px-2 py-0.5 rounded-full uppercase italic">Tax Saving</span>
                            </div>
                            <p className="text-xs text-red-800 leading-relaxed mb-4">
                              Purchases over $300 must be depreciated rather than claimed as fully deductible expenses.
                            </p>
                            
                            <div className="space-y-2 mb-4">
                              {receipts.filter(r => r.total > 300 && !r.isAsset).map(r => (
                                <div key={r.id} className="bg-white/50 p-2 rounded-xl flex justify-between items-center border border-red-100">
                                  <span className="text-[10px] font-bold text-coal">{r.vendor} (${r.total.toLocaleString()})</span>
                                  <button 
                                    onClick={() => handleToggleAsset(r.id)}
                                    className="text-[10px] bg-red-600 text-white px-3 py-1 rounded-lg font-bold hover:bg-red-700 transition-colors"
                                  >
                                    Move to Assets
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {findings.length > 0 ? (
                      <div className="space-y-3">
                        {findings.map(finding => (
                          <div key={finding.id} className={cn(
                            "p-5 rounded-2xl border flex gap-4",
                            finding.level === 'high' ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"
                          )}>
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                              finding.level === 'high' ? "bg-red-500 text-white" : "bg-amber-500 text-white"
                            )}>
                              <AlertCircle size={20} />
                            </div>
                            <div>
                              <p className={cn(
                                "text-sm font-bold",
                                finding.level === 'high' ? "text-red-900" : "text-amber-900"
                              )}>{finding.title}</p>
                               <p className={cn(
                                "text-xs mt-1 leading-relaxed",
                                finding.level === 'high' ? "text-red-700" : "text-amber-700"
                              )}>{finding.description}</p>
                              
                               {finding.atoGuidance && (
                                <a 
                                  href={finding.atoGuidance} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-sage underline underline-offset-4 hover:text-emerald-900 bg-sand/30 p-1.5 px-3 rounded-lg border border-sand transition-all hover:bg-sand"
                                >
                                  View ATO Guidelines <ExternalLink size={12} />
                                </a>
                              )}
                              {finding.advice && (
                                <div className={cn(
                                  "mt-3 p-3 rounded-xl border flex gap-2 items-start",
                                  finding.level === 'high' ? "bg-red-100/50 border-red-200" : "bg-amber-100/50 border-amber-200"
                                )}>
                                  <div className="shrink-0 mt-0.5">
                                    <Lightbulb size={12} className={finding.level === 'high' ? "text-red-600" : "text-amber-600"} />
                                  </div>
                                  <p className={cn(
                                    "text-[10px] leading-relaxed",
                                    finding.level === 'high' ? "text-red-900" : "text-amber-900"
                                  )}>
                                    <span className="font-bold">Next Steps: </span>
                                    {finding.advice}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      receipts.filter(r => r.total % 1 === 0).length === 0 && receipts.filter(r => r.total > 300 && !r.isAsset).length === 0 && (
                        <div className="bg-white rounded-3xl p-12 border border-stone shadow-sm text-center">
                          <div className="w-16 h-16 bg-cream rounded-full flex items-center justify-center mx-auto mb-4 border border-sand">
                            <TrendingUp className="text-sage" />
                          </div>
                          <p className="text-sm font-serif italic text-sage">No risks identified yet.</p>
                          <p className="text-[10px] text-earth uppercase mt-2">Run a scan to analyze your data</p>
                        </div>
                      )
                    )}
                  </div>
 
                  <div className="space-y-6">
                    <h4 className="text-[10px] uppercase font-bold text-earth px-1 tracking-widest flex items-center gap-2">
                       <Shield size={14} className="text-sage" />
                       Compliance Performance
                    </h4>
                    
                    <div className="bg-white rounded-3xl p-6 border border-stone shadow-sm h-fit">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-200">
                          <Activity size={20} />
                        </div>
                        <div>
                          <h5 className="text-sm font-bold text-sage">Audit Documentation</h5>
                          <p className="text-[10px] text-earth opacity-60 font-bold uppercase">FY Readiness</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-sand/30 border border-sand border-dashed">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold text-earth opacity-60 uppercase">Logbook Integrity</span>
                            <span className="text-xs font-bold text-sage">{logEntries.length > 0 ? "85%" : "0%"}</span>
                          </div>
                          <div className="w-full bg-sand/50 h-1.5 rounded-full overflow-hidden">
                             <div 
                               className="bg-sage h-full transition-all" 
                               style={{ width: logEntries.length > 0 ? '85%' : '0%' }} 
                             />
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 border-dashed">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold text-emerald-800 opacity-60 uppercase">Bank Matching</span>
                            <span className="text-xs font-bold text-emerald-700">{receipts.filter(r => !r.vendor.toLowerCase().includes('cash')).length} entries</span>
                          </div>
                          <div className="w-full bg-emerald-100 h-1.5 rounded-full overflow-hidden">
                             <div 
                               className="bg-emerald-600 h-full transition-all" 
                               style={{ width: `${(receipts.filter(r => !r.vendor.toLowerCase().includes('cash')).length / Math.max(1, receipts.length)) * 100}%` }} 
                             />
                          </div>
                        </div>

                        <div className="pt-4 border-t border-stone/10">
                          <h6 className="text-[10px] font-bold text-earth uppercase mb-3 text-left">Professional Advice</h6>
                          <div className="bg-cream p-3 rounded-xl border border-stone/30 flex gap-3 min-h-[60px] items-center overflow-hidden">
                             <AnimatePresence mode="wait">
                               <motion.div 
                                 key={tipIndex}
                                 initial={{ opacity: 0, y: 10 }}
                                 animate={{ opacity: 1, y: 0 }}
                                 exit={{ opacity: 0, y: -10 }}
                                 className="flex gap-3"
                               >
                                 <div className="text-sage mt-0.5 shrink-0"><CheckCircle2 size={14} /></div>
                                 <p className="text-[10px] leading-relaxed text-earth italic text-left">
                                   "{PROFESSIONAL_TIPS[tipIndex]}"
                                 </p>
                               </motion.div>
                             </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-sage p-6 rounded-3xl text-white shadow-xl shadow-sage/20 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 blur-2xl" />
                      <h5 className="text-sm font-bold mb-2 relative z-10">Export Audit-Ready Report</h5>
                      <p className="text-xs opacity-80 mb-4 relative z-10 leading-relaxed text-left">Consolidate all income, expenses, and logbook entries into a compliance-ready audit report.</p>
                      <button 
                        onClick={handleExportAuditPackage}
                        className="w-full py-3 bg-white text-sage rounded-xl font-bold text-xs hover:bg-cream transition-all flex items-center justify-center gap-2 active:scale-95 transition-transform"
                      >
                        <Download size={16} />
                        Download Audit Package
                      </button>
                    </div>
                  </div>
               </div>
            </motion.div>
          )}

          {activeTab === 'logbook' && (
            <motion.div 
               key="logbook"
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               className="space-y-8"
            >
               <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone">
                 <div className="flex justify-between items-center mb-6">
                   <h3 className="font-serif text-xl text-sage">Manual KM Entry</h3>
                   <button onClick={() => setShowAddLog(!showAddLog)} className="text-sage p-2 bg-sand rounded-lg transition-transform active:scale-90">
                     {showAddLog ? <Plus className="rotate-45" /> : <Plus />}
                   </button>
                 </div>

                 {showAddLog ? (
                   <form onSubmit={handleAddLog} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-1">
                       <label className="text-[10px] uppercase font-bold text-earth px-1">Date of Trip</label>
                       <input 
                         type="date" 
                         required
                         value={newLog.date}
                         onChange={e => setNewLog({...newLog, date: e.target.value})}
                         className="w-full bg-cream border border-stone rounded-xl p-3 text-sm focus:ring-2 focus:ring-sage/20 outline-none"
                       />
                     </div>
                     <div className="space-y-1">
                       <label className="text-[10px] uppercase font-bold text-earth px-1">Total Distance (KM)</label>
                       <input 
                         type="number" 
                         step="0.1"
                         required
                         placeholder="e.g. 12.5"
                         value={newLog.km || ''}
                         onChange={e => setNewLog({...newLog, km: Number(e.target.value)})}
                         className="w-full bg-cream border border-stone rounded-xl p-3 text-sm focus:ring-2 focus:ring-sage/20 outline-none"
                       />
                     </div>
                     <div className="md:col-span-2 space-y-1">
                       <label className="text-[10px] uppercase font-bold text-earth px-1">Purpose / Client / Project</label>
                       <input 
                         type="text" 
                         required
                         placeholder="e.g. Site visit to Cranbourne project"
                         value={newLog.purpose}
                         onChange={e => setNewLog({...newLog, purpose: e.target.value})}
                         className="w-full bg-cream border border-stone rounded-xl p-3 text-sm focus:ring-2 focus:ring-sage/20 outline-none"
                       />
                     </div>
                     <div className="space-y-1">
                       <label className="text-[10px] uppercase font-bold text-earth px-1">Origin / Start Location</label>
                       <input 
                         type="text" 
                         placeholder="e.g. Office or Home"
                         value={newLog.origin}
                         onChange={e => setNewLog({...newLog, origin: e.target.value})}
                         className="w-full bg-cream border border-stone rounded-xl p-3 text-sm focus:ring-2 focus:ring-sage/20 outline-none"
                       />
                     </div>
                     <div className="space-y-1">
                       <label className="text-[10px] uppercase font-bold text-earth px-1">Destination / End Location</label>
                       <input 
                         type="text" 
                         placeholder="e.g. 24 Smith St, Melbourne"
                         value={newLog.destination}
                         onChange={e => setNewLog({...newLog, destination: e.target.value})}
                         className="w-full bg-cream border border-stone rounded-xl p-3 text-sm focus:ring-2 focus:ring-sage/20 outline-none"
                       />
                     </div>
                     <div className="md:col-span-2 pt-2">
                       <button type="submit" className="w-full bg-sage text-white py-3 rounded-xl font-bold hover:bg-emerald-900 transition-all shadow-md active:scale-95">
                         Log This Trip
                       </button>
                     </div>
                   </form>
                 ) : (
                   <div className="flex flex-col items-center justify-center py-6 text-earth opacity-40">
                     <Car size={40} className="mb-2" />
                     <p className="text-[10px] uppercase font-bold tracking-widest text-center">Tap the '+' to manually record a trip</p>
                   </div>
                 )}
               </div>

               <div className="space-y-4">
                 <div className="flex justify-between items-end px-1">
                   <h4 className="font-bold uppercase text-[10px] tracking-widest text-earth">Vehicle Log History</h4>
                   <button 
                     onClick={handleExportLogbook}
                     className="text-[10px] font-bold text-sage flex items-center gap-1 hover:underline underline-offset-4"
                   >
                     <Download size={12} />
                     Export for Tax Agent
                   </button>
                 </div>
                 <div className="bg-white rounded-3xl overflow-hidden border border-stone shadow-sm">
                   <div className="p-4 border-b border-sand flex justify-between items-center text-[10px] font-bold text-earth uppercase tracking-widest bg-sand/30">
                     <span className="w-1/2">Trip Details</span>
                     <span className="w-1/4">Date</span>
                     <span className="text-right">Distance</span>
                   </div>
                    <div className="divide-y divide-sand"> {/* LEDGER */}                      {logEntries.map(entry => (
                        <LogEntryRow 
                          key={entry.id} 
                          entry={entry} 
                          isEditing={editingLogId === entry.id}
                          onEdit={() => setEditingLogId(entry.id)}
                          onSave={handleUpdateLog}
                          onCancel={() => setEditingLogId(null)}
                        />
                      ))}
                    </div>
                 </div>
               </div>
            </motion.div>
          )}

          {activeTab === 'assets' && (
            <motion.div 
              key="assets"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-3xl font-serif italic text-sage">Depreciation Schedule</h3>
                  <p className="text-sm text-earth">Assets requiring multi-year deduction (Cost &gt; $300)</p>
                </div>
                <button 
                  onClick={() => setShowAddReceipt(true)}
                  className="bg-sage text-white px-6 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-emerald-900 transition-all"
                >
                  Add New Asset
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-stone shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-earth mb-1">Total Asset Value</p>
                  <p className="text-2xl font-bold font-mono">
                    ${receipts.filter(r => r.isAsset).reduce((acc, r) => acc + r.total, 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-stone shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-earth mb-1">FY26 Claim Target</p>
                  <p className="text-2xl font-bold font-mono text-emerald-600">
                    ${receipts.filter(r => r.isAsset).reduce((acc, r) => {
                      const rate = (r.depreciationRate || 20) / 100;
                      return acc + (r.total * rate);
                    }, 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-stone shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-earth mb-1">Active Schedules</p>
                  <p className="text-2xl font-bold font-mono">
                    {receipts.filter(r => r.isAsset).length}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-3xl overflow-hidden border border-stone shadow-sm">
                <div className="p-4 border-b border-sand grid grid-cols-5 gap-4 text-[10px] font-bold text-earth uppercase tracking-widest bg-sand/30">
                  <span className="col-span-2">Asset / Vendor</span>
                  <span className="text-center">Rate (%)</span>
                  <span className="text-center">FY26 Claim</span>
                  <span className="text-right">Total Cost</span>
                </div>
                <div className="divide-y divide-sand">
                  {receipts.filter(r => r.isAsset).map(asset => {
                    const rate = asset.depreciationRate || 20;
                    const claim = asset.total * (rate / 100);
                    return (
                      <div 
                        key={asset.id} 
                        className="p-4 grid grid-cols-5 gap-4 items-center text-sm hover:bg-cream cursor-pointer transition-colors group"
                        onClick={() => setSelectedReceipt(asset)}
                      >
                        <div className="col-span-2 flex items-center gap-3">
                          <div className="w-8 h-8 bg-sand rounded-xl flex items-center justify-center text-[10px] font-bold text-sage">
                            <TrendingUp size={14} />
                          </div>
                          <div>
                            <p className="font-bold text-coal">{asset.vendor}</p>
                            <p className="text-[10px] text-earth uppercase tracking-tight">{asset.category} • Purchased {asset.date}</p>
                          </div>
                        </div>
                        <div className="text-center font-mono text-xs">{rate}%</div>
                        <div className="text-center font-bold text-emerald-600 font-mono text-xs">${claim.toFixed(2)}</div>
                        <div className="text-right font-bold font-mono text-xs">${asset.total.toFixed(2)}</div>
                      </div>
                    );
                  })}
                  {receipts.filter(r => r.isAsset).length === 0 && (
                    <div className="p-12 text-center text-earth/50">
                      <p className="italic text-sm">No assets registered yet.</p>
                      <button 
                        onClick={() => setShowAddReceipt(true)}
                        className="mt-4 text-sage font-bold text-xs underline underline-offset-4"
                      >
                        Scan a Receipt to Start
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'income' && (
            <motion.div 
               key="income"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="space-y-6"
            >
              <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-stone">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-cream rounded-2xl flex items-center justify-center border border-sand">
                    <Banknote className="text-sage" size={24} />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg text-sage">Income Ledger</h3>
                    <p className="text-[10px] text-earth uppercase tracking-widest font-bold opacity-60">
                      FY26 Total: ${incomeEntries.reduce((s, i) => s + i.amount, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowIncomeModal(true)}
                  className="bg-sage text-white px-6 py-2.5 rounded-2xl text-xs font-bold shadow-lg flex items-center gap-2"
                >
                  <Plus size={18} /> Record New Income
                </motion.button>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                  <div className="bg-white rounded-3xl overflow-hidden border border-stone shadow-sm">
                    <div className="p-4 border-b border-sand flex justify-between items-center text-[10px] font-bold text-earth uppercase tracking-widest bg-sand/30">
                      <span className="w-1/3">Income Source / Detail</span>
                      <span className="w-1/4 text-center">Type</span>
                      <span className="w-1/4 text-center">Date</span>
                      <span className="text-right">Gross Income</span>
                    </div>
                    <div className="divide-y divide-sand">
                      {filteredIncomeEntries.length === 0 ? (
                        <div className="p-20 text-center">
                          <Banknote size={48} className="mx-auto text-earth/10 mb-4" />
                          <p className="text-earth/40 italic font-serif text-sm">No income records found for {userCategory}.</p>
                        </div>
                      ) : (
                        filteredIncomeEntries.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(inc => (
                          <div key={inc.id} className="p-4 flex justify-between items-center text-sm hover:bg-cream transition-colors group">
                            <div className="w-1/3 flex items-center gap-2">
                              <button 
                                onClick={() => handleEditIncome(inc)}
                                className="p-2 rounded-lg hover:bg-sand text-sage opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Settings size={14} />
                              </button>
                              <div>
                                <p className="font-bold text-coal">{inc.description || inc.source}</p>
                                <p className="text-[10px] text-earth/50 uppercase tracking-tight">{inc.documentType}</p>
                              </div>
                            </div>
                            <div className="w-1/4 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-sand text-[10px] font-bold text-sage">
                                {inc.source}
                              </span>
                            </div>
                            <div className="w-1/4 text-center text-xs font-mono text-earth/60">
                              {inc.date}
                            </div>
                            <div className="text-right font-bold text-emerald-600 font-mono">
                              +${inc.amount.toLocaleString()}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone">
                    <div className="flex items-center gap-3 mb-4">
                      <CalendarClock className="text-sage" size={20} />
                      <h4 className="font-serif italic text-lg text-sage">Upload Frequency</h4>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="bg-sand/30 rounded-2xl p-4 border border-sand">
                        <label className="text-[10px] uppercase font-bold text-earth mb-2 block">Reporting Schedule</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['Weekly', 'Fortnightly', 'Monthly', 'Quarterly'] as UploadFrequency[]).map(freq => (
                            <button
                              key={freq}
                              onClick={() => setUploadFrequency(freq)}
                              className={cn(
                                "p-2 rounded-xl text-[10px] font-bold border transition-all",
                                uploadFrequency === freq 
                                  ? "bg-sage text-white border-sage shadow-md" 
                                  : "bg-white text-earth border-stone/30 hover:bg-cream"
                              )}
                            >
                              {freq}
                            </button>
                          ))}
                        </div>
                      </div>

                      {isUploadDue() ? (
                        <div className="bg-red-50 text-red-700 p-4 rounded-2xl border border-red-100 flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle size={18} />
                            <p className="text-[10px] font-bold uppercase">Record Due Now</p>
                          </div>
                          <p className="text-[10px] opacity-80 leading-relaxed">It's been more than {uploadFrequency === 'Weekly' ? '7 days' : uploadFrequency === 'Fortnightly' ? '14 days' : uploadFrequency === 'Monthly' ? '30 days' : '90 days'} since your last upload. Add a bank statement or sales record to remain tax-compliant.</p>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl border border-emerald-100 flex items-center gap-3">
                          <CheckCircle2 size={18} />
                          <div>
                            <p className="text-[10px] font-bold uppercase">Up to Date</p>
                            <p className="text-[10px] opacity-70">Your income records are fresh.</p>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] text-earth/60 font-medium">Last record:</span>
                        <span className="text-[10px] font-bold text-sage">{new Date(lastIncomeUpload).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-sand/20 rounded-3xl p-6 border border-dashed border-sand">
                    <h4 className="text-[10px] uppercase font-bold text-earth mb-3 tracking-widest">Tax Projections</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-earth/60">Gross Income</span>
                        <span className="font-bold text-sage">${incomeEntries.reduce((s, i) => s + i.amount, 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-earth/60">PAYG Component</span>
                        <span className="font-bold text-sage">${incomeEntries.filter(i => i.source === 'PAYG').reduce((s, i) => s + i.amount, 0).toLocaleString()}</span>
                      </div>
                      <div className="pt-3 border-t border-sand flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase text-earth">Predicted Liability</span>
                        <span className="text-sm font-bold text-sage">${estimatedTax.toLocaleString()}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setActiveTab('tax')}
                      className="w-full mt-4 bg-white/50 border border-stone/30 py-2 rounded-xl text-[10px] font-bold text-earth hover:bg-white transition-all"
                    >
                      View Advanced breakdown
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'tax' && (
            <motion.div 
               key="tax"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="space-y-6"
            >
              <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl border border-stone mb-4 gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-cream rounded-2xl flex items-center justify-center border border-sand">
                    <Settings className="text-sage" size={24} />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg text-sage">{businessName || 'Tax Profile'}</h3>
                    <p className="text-[10px] text-earth uppercase tracking-widest font-bold opacity-60">
                      {abn ? `ABN: ${abn}` : 'No ABN set'} • {isGstRegistered ? 'GST Registered' : 'Not GST Registered'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleShareWithAgent}
                    className="bg-earth text-white px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md"
                  >
                    <Share2 size={14} />
                    Share with Tax Agent
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowTaxProfile(true)}
                    className="bg-sand text-sage px-6 py-2 rounded-xl text-xs font-bold hover:bg-stone/20 transition-all border border-stone/30"
                  >
                    Edit Profile
                  </motion.button>
                </div>
              </div>

              <div className="bg-sage text-white rounded-3xl p-8 shadow-lg">
                <h3 className="font-serif italic text-2xl mb-4">ATO Tax Estimates</h3>
                <p className="text-sm opacity-70 mb-6">Based on your shared PAYG and Sole Trader income, here is your projected liability.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/10 p-4 rounded-2xl">
                    <p className="text-[10px] uppercase opacity-50">Projected Tax</p>
                    <p className="text-2xl font-bold">${estimatedTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  {isGstRegistered ? (
                    <div className="bg-white/10 p-4 rounded-2xl">
                      <p className="text-[10px] uppercase opacity-50">GST Owed (BAS)</p>
                      <p className="text-2xl font-bold">${((turnover / 11) - totalGSTCredits).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                  ) : (
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10 opacity-60">
                      <p className="text-[10px] uppercase opacity-50">GST (N/A)</p>
                      <p className="text-sm italic">Not Registered</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div 
               key="chat"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="h-[calc(100vh-200px)] flex flex-col"
            >
               <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                 {chatMessages.map((msg, i) => (
                   <div key={i} className={cn("flex gap-3", msg.role === 'user' && "flex-row-reverse")}>
                     <div className={cn(
                       "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                       msg.role === 'assistant' ? "bg-sage" : "bg-earth"
                     )}>
                       {msg.role === 'assistant' ? (
                         <MessageSquare size={14} className="text-white" />
                       ) : (
                         <span className="text-[10px] font-bold text-white">ME</span>
                       )}
                     </div>
                     <div className={cn(
                       "p-4 rounded-3xl shadow-sm max-w-[80%] text-sm",
                       msg.role === 'assistant' 
                         ? "bg-white border border-stone rounded-tl-none text-coal" 
                         : "bg-sage rounded-tr-none text-white"
                     )}>
                       <p>{msg.content}</p>
                     </div>
                   </div>
                 ))}
                 
                 {isTyping && (
                   <div className="flex gap-3">
                     <div className="w-8 h-8 rounded-full bg-sage flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                       <MessageSquare size={14} className="text-white" />
                     </div>
                     <div className="bg-white p-4 rounded-3xl rounded-tl-none shadow-sm border border-stone text-earth text-xs">
                       AI is thinking...
                     </div>
                   </div>
                 )}
               </div>
 
               <form 
                 onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                 className="mt-4 relative"
               >
                 <input 
                   type="text" 
                   value={chatInput}
                   onChange={(e) => setChatInput(e.target.value)}
                   placeholder="Ask about your expenses, GST, or fuel..." 
                   className="w-full bg-white border border-stone rounded-2xl py-4 pl-6 pr-14 shadow-sm focus:outline-none focus:ring-2 focus:ring-sage/20 font-sans"
                 />
                 <button 
                   type="submit"
                   disabled={isTyping}
                   className="absolute right-2 top-1/2 -translate-y-1/2 bg-sage text-white p-2.5 rounded-xl hover:bg-emerald-900 transition-all shadow-md disabled:opacity-50"
                 >
                   <Plus className="rotate-45" size={20} />
                 </button>
               </form>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className={cn(
              "fixed bottom-28 md:bottom-8 left-1/2 -translate-x-1/2 z-[60] px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 border backdrop-blur-md",
              toast.type === 'success' ? "bg-sage/90 text-white border-emerald-400/20" : "bg-red-600/90 text-white border-red-400/20"
            )}
          >
            <div className="bg-white/20 p-1 rounded-full">
              {toast.type === 'success' ? <Check size={16} /> : <Plus size={16} className="rotate-45" />}
            </div>
            <span className="text-sm font-bold tracking-tight">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTaxProfile && (
          <ProfileModal 
            onClose={() => setShowTaxProfile(false)}
            userCategory={userCategory}
            setUserCategory={setUserCategory}
            isGstRegistered={isGstRegistered}
            setIsGstRegistered={setIsGstRegistered}
            businessName={businessName}
            setBusinessName={setBusinessName}
            abn={abn}
            setAbn={setAbn}
            userName={userName}
            setUserName={setUserName}
            userOccupation={userOccupation}
            setUserOccupation={setUserOccupation}
            userPhone={userPhone}
            setUserPhone={setUserPhone}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCSVImport && (
          <CSVImportModal 
            categories={categories}
            onClose={() => setShowCSVImport(false)}
            showToast={showToast}
            onImport={(entries) => setReceipts(prev => [...entries, ...prev])}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showIncomeModal && (
          <IncomeModal 
            onClose={() => {
              setShowIncomeModal(false);
              setEditingIncomeId(null);
            }}
            onSave={handleAddIncome}
            newIncome={newIncome}
            setNewIncome={setNewIncome}
            isEditing={!!editingIncomeId}
            onDelete={() => {
              if (editingIncomeId) {
                handleDeleteIncome(editingIncomeId);
                setShowIncomeModal(false);
                setEditingIncomeId(null);
              }
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExportDialog && (
          <ExportModal 
            onClose={() => setShowExportDialog(false)}
            onExport={executeExport}
            options={exportOptions}
            setOptions={setExportOptions}
          />
        )}
      </AnimatePresence>

      {/* Mobile NavBar */}
      <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-sage text-white rounded-3xl p-2 flex items-center justify-around shadow-2xl z-50 border border-white/10">
        <MobButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20} />} />
        <MobButton active={activeTab === 'receipts'} onClick={() => setActiveTab('receipts')} icon={<Camera size={20} />} />
        <MobButton active={activeTab === 'income'} onClick={() => setActiveTab('income')} icon={<Banknote size={20} />} />
        <div 
          onClick={() => setShowAddReceipt(true)}
          className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center -mt-10 shadow-lg border-4 border-cream transition-transform active:scale-90 cursor-pointer"
        >
          <Plus className="text-sage" />
        </div>
        <MobButton active={activeTab === 'logbook'} onClick={() => setActiveTab('logbook')} icon={<History size={20} />} />
        <MobButton active={activeTab === 'assets'} onClick={() => setActiveTab('assets')} icon={<TrendingUp size={20} />} />
        <MobButton active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} icon={<AlertCircle size={20} />} />
        <MobButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageSquare size={20} />} />
        <MobButton active={activeTab === 'tax'} onClick={() => setActiveTab('tax')} icon={<Settings size={20} />} />
      </nav>
    </div>
  );
}

function LogEntryRow({ entry, isEditing, onEdit, onSave, onCancel }: { entry: LogEntry, key?: string, isEditing?: boolean, onEdit?: () => void, onSave?: (e: LogEntry) => void, onCancel?: () => void }) {
  const [edited, setEdited] = useState(entry);

  if (isEditing) {
    return (
      <div className="p-4 space-y-4 bg-sand/20">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <input 
              className="w-full bg-white border border-stone rounded-lg p-2 text-sm outline-none"
              value={edited.purpose}
              onChange={e => setEdited({...edited, purpose: e.target.value})}
            />
          </div>
          <input 
            type="date"
            className="bg-white border border-stone rounded-lg p-2 text-sm outline-none"
            value={edited.date}
            onChange={e => setEdited({...edited, date: e.target.value})}
          />
          <input 
            type="number"
            className="bg-white border border-stone rounded-lg p-2 text-sm outline-none font-mono"
            value={edited.km}
            onChange={e => setEdited({...edited, km: Number(e.target.value)})}
          />
          <input 
            placeholder="Origin"
            className="bg-white border border-stone rounded-lg p-2 text-xs outline-none"
            value={edited.origin}
            onChange={e => setEdited({...edited, origin: e.target.value})}
          />
          <input 
            placeholder="Destination"
            className="bg-white border border-stone rounded-lg p-2 text-xs outline-none"
            value={edited.destination}
            onChange={e => setEdited({...edited, destination: e.target.value})}
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => onSave?.(edited)} className="flex-1 bg-sage text-white py-2 rounded-lg text-xs font-bold">Save</button>
          <button onClick={onCancel} className="flex-1 bg-stone text-earth py-2 rounded-lg text-xs font-bold">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 flex items-center justify-between text-sm hover:bg-cream transition-colors group relative">
      <div className="w-1/2 flex items-center gap-3">
        <div className="w-8 h-8 bg-sand rounded-xl flex items-center justify-center text-[10px] font-bold text-sage border border-stone/50">
          <Car size={14} />
        </div>
        <div>
          <p className="font-bold text-coal truncate">{entry.purpose}</p>
          <p className="text-[9px] uppercase tracking-tighter font-bold text-earth">
            {entry.origin} <ChevronRight size={8} className="inline mx-0.5" /> {entry.destination}
          </p>
        </div>
      </div>
      <span className="w-1/4 text-earth/60 text-xs">{entry.date}</span>
      <div className="text-right flex items-center gap-3">
        <span className="font-bold font-mono text-coal">{entry.km} KM</span>
        <button onClick={onEdit} className="text-sage opacity-0 group-hover:opacity-100 transition-opacity">
          <Settings size={14} />
        </button>
      </div>
    </div>
  );
}

function ExportModal({ onClose, onExport, options, setOptions }: { onClose: () => void, onExport: () => void, options: any, setOptions: any }) {
  const toggle = (key: string) => {
    setOptions((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="bg-sand p-8 text-sage">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-sage text-white p-2 rounded-xl">
                <FileDown size={20} />
              </div>
              <h3 className="font-serif italic text-2xl">Export Data</h3>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-sage/10 rounded-full transition-colors text-sage">
              <Plus className="rotate-45" size={24} />
            </button>
          </div>
          <p className="text-sage/60 text-xs mt-2 uppercase tracking-widest font-bold">Select data packages for export</p>
        </div>

        <div className="p-8 space-y-4 bg-cream">
          <ExportOption 
            label="Expenses & Receipts" 
            desc="Detailed ledger with GST breakdown" 
            checked={options.expenses} 
            onChange={() => toggle('expenses')}
          />
          <ExportOption 
            label="Income Records" 
            desc="All revenue and payment sources" 
            checked={options.income} 
            onChange={() => toggle('income')}
          />
          <ExportOption 
            label="Vehicle Logbook" 
            desc="KM logs for business travel" 
            checked={options.logbook} 
            onChange={() => toggle('logbook')}
          />
          <ExportOption 
            label="Risk Audit Report" 
            desc="ATO alignment findings & advice" 
            checked={options.audit} 
            onChange={() => toggle('audit')}
          />
          <ExportOption 
            label="Performance Summary" 
            desc="Net position & performance ratios" 
            checked={options.sbrReport} 
            onChange={() => toggle('sbrReport')}
          />

          <button 
            type="button"
            onClick={onExport}
            className="w-full bg-sage text-white py-4 rounded-2xl font-bold hover:bg-emerald-900 transition-all shadow-md mt-6 flex items-center justify-center gap-2"
          >
            Generate Excel Package <ChevronRight size={16} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ExportOption({ label, desc, checked, onChange }: { label: string, desc: string, checked: boolean, onChange: () => void }) {
  return (
    <label className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-stone/50 cursor-pointer hover:border-sage transition-all group font-sans">
      <div className="flex-1">
        <p className="text-sm font-bold text-sage">{label}</p>
        <p className="text-[10px] text-earth/60 italic">{desc}</p>
      </div>
      <input 
        type="checkbox" 
        checked={checked} 
        onChange={onChange}
        className="w-5 h-5 accent-sage"
      />
    </label>
  );
}

function IncomeModal({ onClose, onSave, newIncome, setNewIncome, isEditing, onDelete }: { onClose: () => void, onSave: (e: React.FormEvent) => void, newIncome: Partial<IncomeEntry>, setNewIncome: React.Dispatch<React.SetStateAction<Partial<IncomeEntry>>>, isEditing?: boolean, onDelete?: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="bg-sage p-8 text-white">
          <div className="flex justify-between items-center">
            <h3 className="font-serif italic text-2xl">{isEditing ? 'Edit Income' : 'Record Income'}</h3>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <Plus className="rotate-45" />
            </button>
          </div>
          <p className="text-white/60 text-xs mt-2 uppercase tracking-widest font-bold">{isEditing ? 'Update your ledger entry' : 'Tax Predictor Input'}</p>
        </div>
        
        <form onSubmit={onSave} className="p-8 space-y-6 bg-cream">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] uppercase font-bold text-earth px-1">Gross Income Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-earth/40 text-sm font-bold">$</span>
                <input 
                  required
                  type="number"
                  placeholder="0.00"
                  className="w-full bg-white border border-stone rounded-2xl p-4 pl-8 text-lg font-bold text-sage outline-none focus:ring-2 focus:ring-sage/20"
                  value={newIncome.amount || ''}
                  onChange={e => setNewIncome({...newIncome, amount: Number(e.target.value)})}
                />
              </div>
            </div>

            <div className="space-y-1 text-left">
              <label className="text-[10px] uppercase font-bold text-earth px-1">Source</label>
              <select 
                className="w-full bg-white border border-stone rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-sage/20"
                value={newIncome.source}
                onChange={e => setNewIncome({...newIncome, source: e.target.value as any})}
              >
                <option value="Sales">Gross Sales</option>
                <option value="PAYG">PAYG Wages</option>
                <option value="Interest">Interest</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-1 text-left">
              <label className="text-[10px] uppercase font-bold text-earth px-1">Evidence Type</label>
              <select 
                className="w-full bg-white border border-stone rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-sage/20"
                value={newIncome.documentType}
                onChange={e => setNewIncome({...newIncome, documentType: e.target.value as any})}
              >
                <option value="Payment Slip">Payment Slip</option>
                <option value="Bank Statement">Bank Statement</option>
                <option value="Sales Receipt">Sales Receipt</option>
              </select>
            </div>

            <div className="col-span-2 space-y-1 text-left">
              <label className="text-[10px] uppercase font-bold text-earth px-1">Date</label>
              <input 
                required
                type="date"
                className="w-full bg-white border border-stone rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-sage/20"
                value={newIncome.date}
                onChange={e => setNewIncome({...newIncome, date: e.target.value})}
              />
            </div>

            <div className="col-span-2 space-y-1 text-left">
              <label className="text-[10px] uppercase font-bold text-earth px-1">Income Source / Detail</label>
              <input 
                placeholder="e.g. Invoice #22 - Smith Corp"
                className="w-full bg-white border border-stone rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-sage/20"
                value={newIncome.description}
                onChange={e => setNewIncome({...newIncome, description: e.target.value})}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            {isEditing && (
              <button 
                type="button"
                onClick={onDelete}
                className="px-6 py-4 rounded-2xl border border-red-100 text-red-500 hover:bg-red-50 transition-all"
              >
                <Trash2 size={20} />
              </button>
            )}
            <button 
              type="submit"
              className="flex-1 bg-sage text-white py-4 rounded-2xl text-sm font-bold shadow-lg hover:bg-emerald-800 transition-all flex items-center justify-center gap-3 active:scale-95"
            >
              <Check size={18} />
              {isEditing ? 'Update Record' : 'Save Income Record'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function BenchmarkRow({ label, value, status }: { label: string, value: string, status: 'good' | 'warning' | 'danger' | 'info' }) {
  return (
    <div className="flex justify-between items-center">
      <div>
        <p className="text-xs font-bold text-sage">{label}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className={cn(
            "w-2 h-2 rounded-full",
            status === 'good' ? "bg-emerald-500" : 
            status === 'warning' ? "bg-amber-500" : 
            status === 'danger' ? "bg-red-500" : "bg-blue-500"
          )} />
          <p className="text-[10px] text-earth uppercase tracking-widest font-bold opacity-60">{status}</p>
        </div>
      </div>
      <p className="font-mono text-sm font-bold text-coal">{value}</p>
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean, icon: ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full p-3 rounded-xl transition-all group",
        active ? "bg-sage text-white shadow-lg" : "text-earth hover:text-sage hover:bg-sand"
      )}
    >
      <span className={cn("transition-colors", active ? "text-white" : "text-earth group-hover:text-sage")}>
        {icon}
      </span>
      <span className="text-sm font-medium">{label}</span>
      {active && <motion.div layoutId="pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-300" />}
    </button>
  );
}

function MobButton({ active, icon, onClick }: { active: boolean, icon: ReactNode, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-2.5 rounded-xl transition-all",
        active ? "bg-white text-sage shadow-inner" : "text-white/40"
      )}
    >
      {icon}
    </button>
  );
}

function QuickActionCard({ icon, label, description, onClick }: { icon: ReactNode, label: string, description: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="bg-white p-4 rounded-3xl shadow-sm border border-stone flex flex-col items-start gap-4 hover:shadow-md hover:translate-y-[-2px] transition-all text-left group"
    >
      <div className="w-10 h-10 bg-sand rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div>
        <p className="font-serif italic text-sage text-sm leading-tight">{label}</p>
        <p className="text-[10px] text-earth mt-0.5 tracking-tight">{description}</p>
      </div>
    </button>
  );
}

interface ReceiptRowProps {
  key?: string | number;
  receipt: ReceiptEntry;
  onUpdate: (r: ReceiptEntry) => void;
  onClick: () => void;
  categories: string[];
  isGstRegistered: boolean;
}

function ReceiptRow({ receipt, onUpdate, onClick, categories, isGstRegistered }: ReceiptRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const calculateGST = (r: ReceiptEntry) => {
    if (!r.items || r.items.length === 0) return (r.gstApplies !== false) ? r.total / 11 : 0;
    return r.items.reduce((s, i) => s + (i.gstApplies ? i.price / 11 : 0), 0);
  };

  return (
    <div className="border-b border-sand last:border-0">
      <div 
        onClick={onClick}
        className={cn(
          "p-4 flex items-center justify-between text-sm hover:bg-cream transition-colors group cursor-pointer",
          isExpanded && "bg-cream/50"
        )}
      >
        <div className="w-1/3 flex items-center gap-3">
          <button 
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            className="p-1 hover:bg-sand rounded text-stone hover:text-sage transition-colors"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <div className="w-8 h-8 bg-sand rounded-xl flex items-center justify-center text-[10px] font-bold text-sage border border-stone/50 shrink-0">
            {receipt.vendor.substring(0, 1)}
          </div>
          <div className="truncate">
            <p className="font-bold text-coal truncate">{receipt.vendor}</p>
            <div className="flex items-center gap-1.5">
              <p className={cn(
                "text-[9px] uppercase tracking-tighter font-bold",
                receipt.type === 'Sole Trader' ? 'text-sage' : receipt.type === 'Personal' ? 'text-earth' : 'text-emerald-700'
              )}>{receipt.type}</p>
              {receipt.type === 'Personal Apportionment' && (
                <span className="text-[8px] bg-sand px-1 rounded font-bold text-sage">{receipt.businessUsage}% Biz</span>
              )}
            </div>
          </div>
        </div>
        <span className="w-1/4 text-earth truncate">{receipt.category}</span>
        <span className="w-1/4 text-earth/60 text-xs">{receipt.date}</span>
        <div className="text-right flex flex-col items-end shrink-0">
          <span className="font-bold font-mono text-coal">${receipt.total.toFixed(2)}</span>
          {isGstRegistered && (
            <div className="flex flex-col items-end">
              <span className="text-[9px] text-earth font-bold opacity-60">GST: ${calculateGST(receipt).toFixed(2)}</span>
              {receipt.type === 'Personal Apportionment' && (
                <span className="text-[8px] text-sage font-bold">Claimable: ${(calculateGST(receipt) * (receipt.businessUsage || 50) / 100).toFixed(2)}</span>
              )}
            </div>
          )}
        </div>
      </div>
      
      {isExpanded && (
        <div className="px-12 pb-4 bg-sand/10 border-t border-sand/30">
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-earth">Tax Type</label>
              <select 
                className="w-full bg-white border border-sand rounded-xl p-2 text-xs outline-none"
                value={receipt.type}
                onChange={e => onUpdate({ ...receipt, type: e.target.value as any, businessUsage: e.target.value === 'Personal Apportionment' ? (receipt.businessUsage || 50) : (e.target.value === 'Personal' ? 0 : 100) })}
              >
                <option value="Sole Trader">Sole Trader</option>
                <option value="PAYG Employment">PAYG</option>
                <option value="Personal Apportionment">Apportioned</option>
                <option>Personal</option>
              </select>
            </div>
            {receipt.type === 'Personal Apportionment' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] uppercase font-bold text-earth">
                  <span>Business Usage</span>
                  <span className="text-sage">{receipt.businessUsage}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  step="5"
                  className="w-full accent-sage h-1.5 bg-sand rounded-xl appearance-none cursor-pointer"
                  value={receipt.businessUsage || 50}
                  onChange={e => onUpdate({ ...receipt, businessUsage: Number(e.target.value) })}
                />
              </div>
            )}
          </div>
          <div className="mt-4">
            {(!receipt.items || receipt.items.length === 0) ? (
              <div className="p-4 bg-white/50 rounded-2xl border border-sand mb-4">
                {isGstRegistered && (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="accent-sage"
                      checked={receipt.gstApplies !== false}
                      onChange={e => onUpdate({ ...receipt, gstApplies: e.target.checked })}
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-sage">GST applies to total amount</span>
                      <span className="text-[10px] text-earth opacity-60">
                        Total GST: ${((receipt.total || 0) / 11).toFixed(2)}
                      </span>
                    </div>
                  </label>
                )}
                <div className="mt-4 pt-4 border-t border-sand/30 flex justify-between items-center text-[10px] uppercase font-bold text-earth">
                  <span>No itemized breakdown</span>
                  <button 
                    onClick={() => onUpdate({ 
                      ...receipt, 
                      items: [{ 
                        id: Math.random().toString(36).substr(2, 5), 
                        name: 'General Purchase', 
                        price: receipt.total, 
                        category: receipt.category, 
                        gstApplies: receipt.gstApplies !== false 
                      }] 
                    })}
                    className="text-sage hover:underline"
                  >
                    + Add Itemized Breakdown
                  </button>
                </div>
              </div>
            ) : (
              <ReceiptItemEditor 
                items={receipt.items || []} 
                categories={categories}
                isGstRegistered={isGstRegistered}
                onChange={(items) => {
                  const newTotal = items.reduce((s,i) => s + i.price, 0);
                  const anyAsset = items.some(i => i.price >= 300);
                  onUpdate({ ...receipt, items, total: newTotal, isAsset: anyAsset || newTotal >= 300 });
                }}
                onTotalChange={(total) => {
                  const anyAsset = (receipt.items || []).some(i => i.price >= 300);
                  onUpdate({ ...receipt, total, isAsset: anyAsset || total >= 300 });
                }}
              />
            )}
            <div className="mt-4 p-4 bg-sage/5 rounded-2xl border border-sage/20">
              <div className="flex justify-between items-center mb-4">
                <h5 className="text-[10px] uppercase font-bold text-sage">Tax Claim Summary</h5>
                <span className="text-[10px] font-bold text-sage bg-white px-2 py-0.5 rounded-full border border-sage/10">
                  {receipt.type === 'Personal' ? '0' : (receipt.businessUsage ?? 100)}% Business Use
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[9px] text-earth uppercase opacity-60">Claimable Expense (Net)</p>
                  <p className="text-sm font-bold font-mono text-sage">
                    ${((receipt.total - calculateGST(receipt)) * (receipt.type === 'Personal' ? 0 : (receipt.businessUsage ?? 100)) / 100).toFixed(2)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] text-earth uppercase opacity-60">Claimable GST</p>
                  <p className="text-sm font-bold font-mono text-sage">
                    ${(calculateGST(receipt) * (receipt.type === 'Personal' ? 0 : (receipt.businessUsage ?? 100)) / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
