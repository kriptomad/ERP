/** Cap. 11–12 — 12 nichos expandidos (além dos 6 fundadores) */

export const EXPANDED_NICHES = [
  {
    code: "FOOD_SERVICE",
    name: "Lanchonete/Restaurante",
    color: "#F97316",
    features: ["Comandas", "KDS", "Taxa de serviço", "Delivery"],
  },
  {
    code: "OPTICAL",
    name: "Ótica",
    color: "#0EA5E9",
    features: ["Grade armação/lente", "OS óptica", "Garantia"],
  },
  {
    code: "PET",
    name: "Petshop/Veterinária",
    color: "#84CC16",
    features: ["Prontuário pet", "Vacinas", "Banho e tosa agenda"],
  },
  {
    code: "FASHION",
    name: "Loja de Roupas/Moda",
    color: "#EC4899",
    features: ["Grade cor/tamanho", "Trocas", "Lookbook"],
  },
  {
    code: "STATIONERY",
    name: "Papelaria/Presentes",
    color: "#8B5CF6",
    features: ["Kits", "Personalização", "Etiquetas"],
  },
  {
    code: "BEAUTY",
    name: "Salão/Barbearia",
    color: "#F472B6",
    features: ["Agenda", "Comissão profissional", "Pacotes"],
  },
  {
    code: "SHOES",
    name: "Loja de Calçados",
    color: "#A78BFA",
    features: ["Grade numeração", "Trocas numeração"],
  },
  {
    code: "CONSTRUCTION",
    name: "Material de Construção",
    color: "#78716C",
    features: ["Metragem", "Cortes", "Entrega obra"],
  },
  {
    code: "AUTO_SHOP",
    name: "Oficina Mecânica",
    color: "#64748B",
    features: ["OS veículo", "Placa/chassi", "Peças + mão de obra"],
  },
  {
    code: "TIRES",
    name: "Loja de Pneus",
    color: "#1E293B",
    features: ["DOT/lote", "Serviços montagem"],
  },
  {
    code: "AUTO_DETAIL",
    name: "Estética Automotiva",
    color: "#06B6D4",
    features: ["Pacotes estética", "Agenda boxes"],
  },
  {
    code: "USED_CARS",
    name: "Veículos Seminovos",
    color: "#2563EB",
    features: ["Estoque veículos", "Documentação", "Financiamento"],
  },
] as const;
