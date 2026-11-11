export interface Provider {
  id: string
  name: string
  contact: string
  phone: string
  created_at?: string
}

export interface ItemStock {
  id: string
  name: string
  stock: number
  cost_price: number
  created_at?: string
}

export interface Product {
  id: string
  name: string
  provider_id: string
  base_cost: number
  final_cost: number
  sale_price: number
  image_url?: string
  stock: number
  created_at?: string
  providers?: Provider
}