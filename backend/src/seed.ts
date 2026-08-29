import 'dotenv/config'
import { connectDatabase, closeDatabase } from './db'
import { SkuMaster } from './models/schemas'

const defaultSkus = [
  {
    skuErpCode: '11423',
    eanCode: 'FG-P-F-0503',
    name: 'Cheesy Spicy Veg Momos 24 Pcs',
    hsnCode: '19022010',
    uom: 'PKT',
    agreedRate: 220.76,
    mrp: 305.0,
    priceTolerance: 0.05,
  },
  {
    skuErpCode: '11797',
    eanCode: 'FG-M-F-1703',
    name: 'Meatigo Hot Wings 250g',
    hsnCode: '16023200',
    uom: 'PKT',
    agreedRate: 126.67,
    mrp: 175.0,
    priceTolerance: 0.05,
  },
  {
    skuErpCode: '18003',
    eanCode: 'FG-M-F-0620',
    name: 'Meatigo Chicken Curry Cut Skinless Frozen 450g',
    hsnCode: '02071400',
    uom: 'KG',
    agreedRate: 141.14,
    mrp: 195.0,
    priceTolerance: 0.05,
  },
  {
    skuErpCode: '18004',
    eanCode: 'FG-M-F-0619',
    name: 'Meatigo Chicken Boneless Breast Frozen 450g',
    hsnCode: '02071400',
    uom: 'KG',
    agreedRate: 199.05,
    mrp: 275.0,
    priceTolerance: 0.05,
  },
  {
    skuErpCode: '205950',
    eanCode: 'FG-P-F-0248',
    name: 'Pork Pepperoni Salami 100g',
    hsnCode: '16010000',
    uom: 'PKT',
    agreedRate: 133.91,
    mrp: 185.0,
    priceTolerance: 0.05,
  },
  {
    skuErpCode: '253430',
    eanCode: 'FG-P-F-0204',
    name: 'Pork Salami 200g',
    hsnCode: '16010000',
    uom: 'PKT',
    agreedRate: 188.19,
    mrp: 260.0,
    priceTolerance: 0.05,
  },
  {
    skuErpCode: '33387',
    eanCode: 'FG-M-F-0413',
    name: 'Frozen Chicken Chili Salami 200g',
    hsnCode: '16023200',
    uom: 'PKT',
    agreedRate: 126.67,
    mrp: 175.0,
    priceTolerance: 0.05,
  },
  {
    skuErpCode: '33390',
    eanCode: 'FG-M-F-0402',
    name: 'Chicken Seekh Kebab 500g',
    hsnCode: '02071400',
    uom: 'PKT',
    agreedRate: 228.03,
    mrp: 315.0,
    priceTolerance: 0.05,
  },
  {
    skuErpCode: '398656',
    eanCode: 'FG-M-F-1707',
    name: 'Meatigo Chicken Drumsticks 450g',
    hsnCode: '02071400',
    uom: 'PKT',
    agreedRate: 188.19,
    mrp: 260.0,
    priceTolerance: 0.05,
  },
  {
    skuErpCode: '414867',
    eanCode: 'FG-P-F-0522',
    name: 'Chinese Veg Spring Roll 240g',
    hsnCode: '19022010',
    uom: 'PKT',
    agreedRate: 119.43,
    mrp: 165.0,
    priceTolerance: 0.05,
  },
]

async function seed() {
  try {
    console.log('[SEED] Connecting to database...')
    await connectDatabase()

    for (const item of defaultSkus) {
      await SkuMaster.findOneAndUpdate(
        { skuErpCode: item.skuErpCode },
        item,
        { upsert: true, returnDocument: 'after' }
      )
    }

    console.log(`[SEED] Successfully seeded ${defaultSkus.length} SKU Master records`)
  } catch (error) {
    console.error('[SEED] Error seeding SKU Master:', error)
  } finally {
    await closeDatabase()
  }
}

seed()
