export type OsmTag = { key: string; value: string };

export type Industry = {
  id: string;
  label: string;
  blurb: string;
  tags: OsmTag[];
  sampleNames: string[];
};

export const INDUSTRIES: Industry[] = [
  {
    id: "restaurants",
    label: "Restaurants & cafes",
    blurb: "High local search volume. Many still run on Facebook pages or old menus.",
    tags: [
      { key: "amenity", value: "restaurant" },
      { key: "amenity", value: "cafe" },
      { key: "amenity", value: "fast_food" },
    ],
    sampleNames: [
      "Harbor Table",
      "Little Juniper Cafe",
      "Red Porch Kitchen",
      "Nightjar Bar & Grill",
      "Salt & Cedar",
      "The Side Street Diner",
      "Mango Room",
      "Oak & Onion",
    ],
  },
  {
    id: "salons",
    label: "Hair & beauty",
    blurb: "Independent salons often have no booking site — a fast, high-intent offer.",
    tags: [
      { key: "shop", value: "hairdresser" },
      { key: "shop", value: "beauty" },
      { key: "shop", value: "nails" },
    ],
    sampleNames: [
      "Goldfinch Salon",
      "Ribbon & Root",
      "Northlight Beauty",
      "The Cut Room",
      "Velvet Chair",
      "Luna Nail Bar",
      "Bramble Hair",
      "Copper Mirror Studio",
    ],
  },
  {
    id: "dentists",
    label: "Dentists",
    blurb: "Patients Google first. Thin or outdated clinic sites leak appointments.",
    tags: [{ key: "amenity", value: "dentist" }],
    sampleNames: [
      "Maple & Pine Dental",
      "Riverside Family Dentistry",
      "Brightline Dental",
      "Cedar Park Smiles",
      "Lakeside Orthodontics",
      "Summit Tooth Co.",
      "Elm Street Dental",
      "Harborview Dentistry",
    ],
  },
  {
    id: "plumbers",
    label: "Plumbers & HVAC",
    blurb: "Emergency trades win on mobile speed. Many still have no website at all.",
    tags: [
      { key: "craft", value: "plumber" },
      { key: "craft", value: "hvac" },
      { key: "shop", value: "plumbing" },
    ],
    sampleNames: [
      "True North Plumbing",
      "Rapid Coil HVAC",
      "Blue Wren Drain Co.",
      "Ironwood Mechanical",
      "All-Hours Pipeworks",
      "Summit Air & Heat",
      "Clearflow Plumbing",
      "Lantern HVAC",
    ],
  },
  {
    id: "auto",
    label: "Auto repair",
    blurb: "Shops with only a Google listing miss service-booking and trust pages.",
    tags: [
      { key: "shop", value: "car_repair" },
      { key: "shop", value: "car" },
      { key: "amenity", value: "vehicle_inspection" },
    ],
    sampleNames: [
      "Redline Auto Works",
      "Pioneer Garage",
      "Eastside Alignment",
      "Kestrel Motors",
      "Harbor Brake & Tire",
      "Third Street Auto",
      "Northwind Repair",
      "Copper State Garage",
    ],
  },
  {
    id: "lawyers",
    label: "Law firms",
    blurb: "Credibility is the product. Dated sites quietly lose retainers.",
    tags: [
      { key: "office", value: "lawyer" },
      { key: "office", value: "attorney" },
    ],
    sampleNames: [
      "Ashford & Bell",
      "River Court Law",
      "Northbridge Legal",
      "Wren Family Law",
      "Harbor Counsel",
      "Pike & Vale Attorneys",
      "Lumen Law Group",
      "Stonegate Legal",
    ],
  },
  {
    id: "fitness",
    label: "Gyms & studios",
    blurb: "Class schedules and trial offers convert — if the site can carry them.",
    tags: [
      { key: "leisure", value: "fitness_centre" },
      { key: "leisure", value: "sports_centre" },
      { key: "sport", value: "yoga" },
    ],
    sampleNames: [
      "Kiln Fitness",
      "Dawn Body Studio",
      "Iron District Gym",
      "Willow Reformer",
      "Night Shift Athletics",
      "Basecamp Training",
      "Solstice Yoga",
      "Forge Strength Club",
    ],
  },
  {
    id: "realestate",
    label: "Real estate",
    blurb: "Agents still using template pages or Facebook-only listings.",
    tags: [{ key: "office", value: "estate_agent" }],
    sampleNames: [
      "Lantern Realty",
      "Cove & County Homes",
      "Northbird Properties",
      "Amber Field Realty",
      "Harborline Estates",
      "Pine Street Brokers",
      "Vale House Group",
      "Summit Lot Realty",
    ],
  },
  {
    id: "contractors",
    label: "Builders & landscapers",
    blurb: "Photo-led portfolio sites close higher-ticket jobs.",
    tags: [
      { key: "craft", value: "builder" },
      { key: "craft", value: "carpenter" },
      { key: "craft", value: "gardener" },
      { key: "office", value: "construction_company" },
    ],
    sampleNames: [
      "Hearth & Timber",
      "Greenline Landscapes",
      "North Frame Builders",
      "Cedar Path Outdoor",
      "Ridgework Construction",
      "Wilder Gardens",
      "Beacon Build Co.",
      "Lot Line Carpentry",
    ],
  },
  {
    id: "pets",
    label: "Vets & pet care",
    blurb: "Anxious pet owners bounce from slow or mobile-broken clinic sites.",
    tags: [
      { key: "amenity", value: "veterinary" },
      { key: "shop", value: "pet" },
      { key: "shop", value: "pet_grooming" },
    ],
    sampleNames: [
      "Kindred Vet",
      "Paw & Pine",
      "Lakeside Animal Clinic",
      "The Groom Room",
      "Northfield Pets",
      "Harbor Hound Co.",
      "Willow Veterinary",
      "Little Beast Grooming",
    ],
  },
  {
    id: "retail",
    label: "Local shops",
    blurb: "Boutiques with hours-only Google listings leave money on the table.",
    tags: [
      { key: "shop", value: "clothes" },
      { key: "shop", value: "florist" },
      { key: "shop", value: "bakery" },
      { key: "shop", value: "gift" },
    ],
    sampleNames: [
      "Paper Bird Florist",
      "The Fold Boutique",
      "Crumb & Crust Bakery",
      "Night Market Goods",
      "Harbor Gift Co.",
      "Linen Room",
      "Marigold Floral",
      "Sunday Provisions",
    ],
  },
  {
    id: "health",
    label: "Clinics & wellness",
    blurb: "Chiropractors, spas, and therapists with brochure sites from 2014.",
    tags: [
      { key: "amenity", value: "clinic" },
      { key: "amenity", value: "doctors" },
      { key: "shop", value: "massage" },
      { key: "healthcare", value: "physiotherapist" },
    ],
    sampleNames: [
      "Northlight Wellness",
      "Quiet Spine Clinic",
      "Amber Hour Spa",
      "Riverbend Physio",
      "Solace Massage",
      "Cove Family Clinic",
      "Lumen Chiropractic",
      "The Rest Practice",
    ],
  },
];

export function getIndustry(id: string): Industry {
  return INDUSTRIES.find((item) => item.id === id) ?? INDUSTRIES[0];
}
