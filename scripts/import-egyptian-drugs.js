const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

// 1. Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  console.log("Loading .env.local...");
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('=');
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    process.env[key] = value;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}

// Initialize Supabase Client with service key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Fixed pharmacy ID from public.pharmacies
const PHARMACY_ID = "6bc973bf-b4fe-4738-b090-f42cb4099fee";

// Generate clean EAN-13 barcode starting with 622 (Egypt country code)
function generateEan13(existingBarcodes) {
  let attempts = 0;
  while (attempts < 1000) {
    let code = "622";
    for (let i = 0; i < 9; i++) {
      code += Math.floor(Math.random() * 10);
    }
    
    // Calculate EAN-13 checksum digit
    let sumOdd = 0;
    let sumEven = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(code[i], 10);
      if (i % 2 === 0) {
        sumOdd += digit;
      } else {
        sumEven += digit;
      }
    }
    const total = sumOdd + sumEven * 3;
    const checksum = (10 - (total % 10)) % 10;
    const fullBarcode = code + checksum;
    
    if (!existingBarcodes.has(fullBarcode)) {
      existingBarcodes.add(fullBarcode);
      return fullBarcode;
    }
    attempts++;
  }
  throw new Error("Failed to generate a unique barcode after 1000 attempts");
}

// Broad category mapping function to ensure premium UX (instead of 2400 categories)
function mapDrugClassToCategoryName(drugClass) {
  if (!drugClass || drugClass === ".") return "أخرى";
  const dc = drugClass.toUpperCase();
  
  if (dc.includes("SKIN") || dc.includes("HAIR") || dc.includes("COSMETIC") || dc.includes("SUN BLOCK") || dc.includes("MASSAGE") || dc.includes("CREAM") || dc.includes("LIP") || dc.includes("SHAMPOO") || dc.includes("SOAP")) {
    return "العناية بالبشرة";
  }
  if (dc.includes("VITAMIN") || dc.includes("SUPPLEMENT") || dc.includes("CALCIUM") || dc.includes("IRON") || dc.includes("MINERAL") || dc.includes("NUTRITION")) {
    return "الفيتامينات";
  }
  if (dc.includes("ANTIBIOTIC") || dc.includes("ANTIFUNGAL") || dc.includes("ANTIVIRAL") || dc.includes("ANTI-INFECTIVE")) {
    return "المضادات الحيوية";
  }
  if (dc.includes("NSAID") || dc.includes("ANALGESIC") || dc.includes("PAIN") || dc.includes("ANESTHETIC") || dc.includes("ANTIPYRETIC")) {
    return "المسكنات";
  }
  if (dc.includes("DIABET") || dc.includes("INSULIN") || dc.includes("HYPOGLYCEMIC")) {
    return "أدوية السكري";
  }
  if (dc.includes("HYPERTENSION") || dc.includes("CARDIO") || dc.includes("STATIN") || dc.includes("ANTIHYPERLIPIDEMIC") || dc.includes("HEART") || dc.includes("VASCULAR") || dc.includes("BETA-BLOCKER")) {
    return "أدوية الضغط والقلب";
  }
  if (dc.includes("ULCER") || dc.includes("GASTRO") || dc.includes("STOMACH") || dc.includes("LAXATIVE") || dc.includes("DIGESTIVE") || dc.includes("COLON") || dc.includes("ANTACID") || dc.includes("PROTON PUMP")) {
    return "أدوية الجهاز الهضمي";
  }
  if (dc.includes("ALLERGY") || dc.includes("HISTAMINE") || dc.includes("COLD") || dc.includes("COUGH") || dc.includes("RESPIRATORY") || dc.includes("ASTHMA") || dc.includes("DECONGESTANT")) {
    return "أدوية الحساسية والصدر";
  }
  if (dc.includes("PSYCHIATRIC") || dc.includes("ANTIDEPRESSANT") || dc.includes("ANTIPSYCHOTIC") || dc.includes("NEURO") || dc.includes("EPILEPSY") || dc.includes("CNS") || dc.includes("SEDATIVE")) {
    return "أدوية الأعصاب والنفسية";
  }
  if (dc.includes("PEDIATRIC") || dc.includes("INFANT") || dc.includes("BABY")) {
    return "أطفال";
  }
  if (dc.includes("SYRINGE") || dc.includes("BANDAGE") || dc.includes("GLOVE") || dc.includes("DEVICE") || dc.includes("INSTRUMENT") || dc.includes("NEEDLE")) {
    return "أدوات طبية";
  }
  
  return "أخرى";
}

async function run() {
  console.log("=== STARTING EGYPTIAN DRUG DATABASE IMPORT ===");

  // 2. Fetch existing products and barcodes to avoid duplicates and collisions
  console.log("Fetching existing products and barcodes from Supabase...");
  const { data: existingProducts, error: prodError } = await supabase
    .from("products")
    .select("barcode, name")
    .eq("pharmacy_id", PHARMACY_ID);
    
  if (prodError) {
    console.error("Error fetching existing products:", prodError);
    process.exit(1);
  }
  
  const existingBarcodes = new Set(existingProducts.map(p => p.barcode));
  const existingNames = new Set(existingProducts.map(p => p.name.toUpperCase().trim()));
  console.log(`Loaded ${existingProducts.length} existing products.`);

  // 3. Fetch categories and create missing ones
  console.log("Fetching categories...");
  const { data: existingCategories, error: catError } = await supabase
    .from("categories")
    .select("id, name");
    
  if (catError) {
    console.error("Error fetching categories:", catError);
    process.exit(1);
  }

  const categoryMap = {}; // name -> id
  for (const cat of existingCategories) {
    categoryMap[cat.name] = cat.id;
  }
  console.log(`Loaded ${existingCategories.length} categories.`);

  // 4. Fetch the Egyptian drugs dataset from Github
  console.log("Downloading Egyptian Drug Database JSON from GitHub (may take a few seconds)...");
  const datasetUrl = "https://raw.githubusercontent.com/karem505/egyptian-drug-database/main/data/egyptian-drugs.json";
  const response = await fetch(datasetUrl);
  if (!response.ok) {
    throw new Error(`Failed to download dataset: ${response.statusText}`);
  }
  
  const drugs = await response.json();
  console.log(`Successfully loaded ${drugs.length} drugs from dataset.`);

  // 5. Build list of unique products to import
  const toImport = [];
  const processedNamesInRun = new Set();
  
  for (const drug of drugs) {
    const name = drug.commercial_name_en?.trim();
    if (!name) continue;
    
    const nameUpper = name.toUpperCase();
    
    // Skip if already in the database or already processed in this script run
    if (existingNames.has(nameUpper) || processedNamesInRun.has(nameUpper)) {
      continue;
    }
    
    processedNamesInRun.add(nameUpper);
    toImport.push(drug);
  }
  
  console.log(`Filtering complete. Found ${toImport.length} new drugs to import.`);
  
  if (toImport.length === 0) {
    console.log("No new drugs to import. Everything is already imported!");
    return;
  }

  // 6. Ensure all required categories exist
  console.log("Checking and creating categories if needed...");
  const uniqueTargetCategories = new Set();
  for (const drug of toImport) {
    const catName = mapDrugClassToCategoryName(drug.drug_class);
    uniqueTargetCategories.add(catName);
  }

  for (const catName of uniqueTargetCategories) {
    if (!categoryMap[catName]) {
      console.log(`Category "${catName}" not found. Creating it...`);
      const { data: newCat, error: createCatErr } = await supabase
        .from("categories")
        .insert({
          name: catName,
          pharmacy_id: PHARMACY_ID,
          description: `قسم ${catName}`
        })
        .select()
        .single();
        
      if (createCatErr) {
        console.error(`Failed to create category "${catName}":`, createCatErr);
        // Fallback to "أخرى" if it exists, or create a simple fallback
        categoryMap[catName] = categoryMap["أخرى"] || null;
      } else {
        categoryMap[catName] = newCat.id;
        console.log(`Created category "${catName}" with ID: ${newCat.id}`);
      }
    }
  }

  // 7. Perform batch insertion
  console.log("Starting batch insertion of products...");
  const BATCH_SIZE = 400;
  let totalInserted = 0;
  
  for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
    const batch = toImport.slice(i, i + BATCH_SIZE);
    const productRows = [];
    
    for (const drug of batch) {
      const barcode = generateEan13(existingBarcodes);
      const sellingPrice = drug.price_egp || 0.00;
      // standard 25% profit margin => purchase_price = sellingPrice * 0.75
      const purchasePrice = Math.round(sellingPrice * 0.75 * 100) / 100;
      
      const catName = mapDrugClassToCategoryName(drug.drug_class);
      const categoryId = categoryMap[catName] || null;
      
      const description = [
        drug.route ? `Route: ${drug.route}` : "",
        drug.manufacturer ? `Manufacturer: ${drug.manufacturer}` : "",
        drug.drug_class ? `Therapeutic Class: ${drug.drug_class}` : ""
      ].filter(Boolean).join(" | ");

      productRows.push({
        barcode,
        name: drug.commercial_name_en.trim(),
        description: description || null,
        category_id: categoryId,
        purchase_price: purchasePrice,
        selling_price: sellingPrice,
        stock_quantity: 0, // catalog only
        min_stock_alert: 10,
        strips_per_box: 1,
        pills_per_strip: 1,
        pharmacy_id: PHARMACY_ID,
        active_ingredient: drug.scientific_name ? drug.scientific_name.trim() : null
      });
    }

    const { error: insertErr } = await supabase
      .from("products")
      .insert(productRows);
      
    if (insertErr) {
      console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, insertErr);
      console.log("Attempting to insert row-by-row in this batch due to error...");
      
      // Fallback row-by-row insertion for safety in case of individual row issues
      for (const row of productRows) {
        const { error: singleErr } = await supabase.from("products").insert(row);
        if (singleErr) {
          console.error(`Failed to insert "${row.name}":`, singleErr.message);
        } else {
          totalInserted++;
        }
      }
    } else {
      totalInserted += productRows.length;
      console.log(`Inserted batch ${i / BATCH_SIZE + 1}: ${totalInserted}/${toImport.length} products...`);
    }
  }

  console.log(`\n=== IMPORT COMPLETED SUCCESSFULY ===`);
  console.log(`Successfully imported ${totalInserted} new Egyptian drugs into Supabase!`);
}

run().catch(console.error);
