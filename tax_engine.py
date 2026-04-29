import datetime
import math

class TradieTaxEngine:
    def __init__(self, user_category="Sole Trader", is_gst_registered=False):
        self.user_category = user_category
        self.is_gst_registered = is_gst_registered
        self.income_entries = []
        self.receipts = []
        self.log_entries = []
        
        # 2026-27 AU Tax Brackets (Sample matching App logic)
        self.brackets = [
            (18200, 0.00, 0),
            (45000, 0.16, 0),
            (120000, 0.30, 4288),
            (180000, 0.37, 26788),
            (float('inf'), 0.45, 48988)
        ]

    def add_income(self, amount, date, source, description):
        self.income_entries.append({
            "amount": amount,
            "date": date,
            "source": source,
            "description": description
        })

    def add_receipt(self, vendor, total, category, is_asset=False):
        self.receipts.append({
            "vendor": vendor,
            "total": total,
            "category": category,
            "is_asset": is_asset or total >= 300
        })

    def calculate_totals(self):
        turnover = sum(item['amount'] for item in self.income_entries)
        raw_expenses = sum(item['total'] for item in self.receipts)
        
        # Simple GST calculation (1/11th if registered)
        gst_collected = (turnover / 11) if self.is_gst_registered else 0
        gst_paid = sum((r['total'] / 11) for r in self.receipts if r['category'] != 'Personal') if self.is_gst_registered else 0
        
        net_income = turnover - gst_collected
        net_expenses = raw_expenses - gst_paid
        taxable_income = max(0, net_income - net_expenses)
        
        return {
            "turnover": turnover,
            "taxable_income": taxable_income,
            "net_profit": net_income - net_expenses,
            "gst_position": gst_collected - gst_paid
        }

    def estimate_tax(self, taxable_income):
        tax = 0
        prev_limit = 0
        for limit, rate, base in self.brackets:
            if taxable_income > prev_limit:
                current_taxable = min(taxable_income, limit) - prev_limit
                tax += current_taxable * rate
                prev_limit = limit
            else:
                break
        return tax

    def run_audit(self):
        findings = []
        totals = self.calculate_totals()
        
        # Logic 1: GST Threshold
        if self.user_category == "Sole Trader" and totals['turnover'] > 75000 and not self.is_gst_registered:
            findings.append({
                "risk": "HIGH",
                "issue": "Mandatory GST Registration",
                "advice": "Turnover exceeds $75k. You must register within 21 days."
            })
            
        # Logic 2: Round Numbers
        round_entries = [r for r in self.receipts if r['total'] % 1 == 0]
        if len(round_entries) > 0:
            findings.append({
                "risk": "MEDIUM",
                "issue": "Estimated Expenses Detected",
                "advice": f"Found {len(round_entries)} entries with exactly $0 cents. ATO flags these as potential estimates."
            })
            
        return findings

# Example Usage
if __name__ == "__main__":
    engine = TradieTaxEngine(user_category="Sole Trader", is_gst_registered=False)
    
    # Mock data
    engine.add_income(85000, "2026-04-15", "Sales", "Renovation Project")
    engine.add_receipt("Bunnings", 1240.00, "Materials")
    engine.add_receipt("Shell", 85.00, "Fuel") # Round number risk
    
    results = engine.calculate_totals()
    tax = engine.estimate_tax(results['taxable_income'])
    risks = engine.run_audit()
    
    print(f"--- TradieTax Python Core v2.0 ---")
    print(f"Annual Turnover: ${results['turnover']:,.2f}")
    print(f"Taxable Income: ${results['taxable_income']:,.2f}")
    print(f"Estimated Tax Payable: ${tax:,.2f}")
    print(f"\nAudit Risk Scan:")
    for r in risks:
        print(f"[{r['risk']}] {r['issue']}: {r['advice']}")
