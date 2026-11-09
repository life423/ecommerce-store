const pairings = {
  Planters: [
    ['Seeds', 'RW-DEMO-GENOVESE-BASIL-SEEDS'],
    ['Tools & care', 'RW-DEMO-INDOOR-POTTING-BLEND'],
    ['Tools & care', 'RW-DEMO-CREAM-LEDGE-WATERING-CAN'],
  ],
  Seeds: [
    ['Planters', 'RW-DEMO-MOSS-RIBBED-POT'],
    ['Tools & care', 'RW-DEMO-INDOOR-POTTING-BLEND'],
    ['Tools & care', 'RW-DEMO-SLATE-MARKER-SET'],
  ],
  'Growing kits': [
    ['Tools & care', 'RW-DEMO-CREAM-LEDGE-WATERING-CAN'],
    ['Tools & care', 'RW-DEMO-SLATE-MARKER-SET'],
    ['Tools & care', 'RW-DEMO-MOSS-PRECISION-SNIPS'],
  ],
  'Tools & care': [
    ['Planters', 'RW-DEMO-MOSS-RIBBED-POT'],
    ['Seeds', 'RW-DEMO-GENOVESE-BASIL-SEEDS'],
    ['Tools & care', 'RW-DEMO-INDOOR-POTTING-BLEND'],
  ],
}

export async function findRelatedProducts(Product, product) {
  const slots = pairings[product.category] ?? []
  const available = { status: 'active', inventory: { $gt: 0 } }
  const preferred = await Product.find({
    ...available,
    _id: { $ne: product._id },
    sku: { $in: slots.map(([, sku]) => sku) },
  }).lean()

  const items = slots.map(([category, sku]) =>
    preferred.find(item => item.sku === sku && item.category === category),
  )
  const excluded = [product._id, ...items.filter(Boolean).map(item => item._id)]

  for (const [index, [category]] of slots.entries()) {
    if (items[index]) continue
    const alternative = await Product.findOne({ ...available, category, _id: { $nin: excluded } })
      .sort({ featured: -1, name: 1, _id: 1 }).lean()
    if (alternative) {
      items[index] = alternative
      excluded.push(alternative._id)
    }
  }

  return items.filter(Boolean)
}
