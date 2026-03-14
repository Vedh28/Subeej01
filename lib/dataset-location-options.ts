export const DATASET_DISTRICTS_BY_STATE: Record<string, string[]> = {
  "Andhra Pradesh": ["Anantapur", "Guntur", "Kurnool", "Vijayawada"],
  "Bihar": ["Bhagalpur", "Gaya", "Muzaffarpur", "Patna"],
  "Chhattisgarh": ["Bilaspur", "Durg", "Raipur", "Rajnandgaon"],
  "Gujarat": ["Ahmedabad", "Junagadh", "Rajkot", "Surat"],
  "Haryana": ["Hisar", "Karnal", "Rohtak", "Sirsa"],
  "Karnataka": ["Belagavi", "Dharwad", "Mysuru", "Raichur"],
  "Madhya Pradesh": ["Bhopal", "Indore", "Jabalpur", "Ujjain"],
  "Maharashtra": ["Akola", "Nagpur", "Nashik", "Pune"],
  "Odisha": ["Balasore", "Cuttack", "Puri", "Sambalpur"],
  "Punjab": ["Amritsar", "Bathinda", "Ludhiana", "Patiala"],
  "Rajasthan": ["Ajmer", "Bikaner", "Jaipur", "Kota"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Thanjavur"],
  "Telangana": ["Hyderabad", "Karimnagar", "Nizamabad", "Warangal"],
  "Uttar Pradesh": ["Kanpur", "Lucknow", "Meerut", "Varanasi"],
  "West Bengal": ["Bardhaman", "Kolkata", "Malda", "Murshidabad"],
};

export const DATASET_STATE_OPTIONS = Object.keys(DATASET_DISTRICTS_BY_STATE).sort() as string[];