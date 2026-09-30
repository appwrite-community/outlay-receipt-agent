import {
  AppWindow,
  BedDouble,
  Building2,
  CarTaxiFront,
  Landmark,
  Laptop,
  type LucideIcon,
  Shapes,
  TrainFront,
  UtensilsCrossed,
} from 'lucide-react'
import type { Category } from './types'

export const CATEGORIES: { id: Category; label: string; icon: LucideIcon }[] = [
  { id: 'meals', label: 'Meals', icon: UtensilsCrossed },
  { id: 'travel', label: 'Travel', icon: TrainFront },
  { id: 'lodging', label: 'Lodging', icon: BedDouble },
  { id: 'transport', label: 'Transport', icon: CarTaxiFront },
  { id: 'software', label: 'Software', icon: AppWindow },
  { id: 'equipment', label: 'Equipment', icon: Laptop },
  { id: 'office', label: 'Office', icon: Building2 },
  { id: 'fees', label: 'Fees', icon: Landmark },
  { id: 'other', label: 'Other', icon: Shapes },
]

const byId = new Map(CATEGORIES.map((category) => [category.id, category]))

export const categoryLabel = (id: Category) => byId.get(id)?.label ?? id
export const categoryIcon = (id: Category | null) => (id ? byId.get(id)?.icon : undefined) ?? Shapes
export const isCategory = (value: string): value is Category => byId.has(value as Category)
