import enum


class AccountType(str, enum.Enum):
    cash = "cash"
    card = "card"
    deposit = "deposit"
    savings = "savings"
    other = "other"


class CategoryType(str, enum.Enum):
    income = "income"
    expense = "expense"


class TransactionType(str, enum.Enum):
    income = "income"
    expense = "expense"
    transfer = "transfer"


class RecurrenceFrequency(str, enum.Enum):
    weekly = "weekly"
    monthly = "monthly"
    yearly = "yearly"


class ThemePreference(str, enum.Enum):
    light = "light"
    dark = "dark"
