from pydantic import BaseModel, field_validator
from datetime import date
from typing import List, Optional

class FinancialResponsibility(BaseModel):
    name: str
    amount: float
    currency: str
    due_date: date
    category: Optional[str] = "Other"
    priority_level: int = 2
    is_paid: bool = False

    @field_validator('currency')
    @classmethod
    def validate_currency(cls, v: str) -> str:
        if v.upper() not in ["USD", "BRL"]:
            raise ValueError("Currency must be USD or BRL for this POC")
        return v.upper()

class VisionAccountantOutput(BaseModel):
    actual_liabilities: List[FinancialResponsibility]
    predicted_liabilities: List[FinancialResponsibility]
