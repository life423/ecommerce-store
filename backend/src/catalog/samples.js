export const sampleProducts = [
  {
    name: 'The Balcony Grow Box', slug: 'the-balcony-grow-box', sku: 'RW-PLANTER-01', category: 'Planters',
    priceCents: 6800, inventory: 18, featured: true, badge: 'Starter favorite',
    description: 'Your little patch of possibility. A generously sized terracotta planter and matching tray make a home for herbs, leafy greens, or whatever you are curious to grow next. Designed to turn an overlooked corner into your favorite spot.',
    highlights: ['Terracotta planter with matching drip tray', 'A compact footprint for balconies and patios', 'Plants shown for inspiration; planter sold on its own'],
    images: [{ url: '/images/planter.jpg', alt: 'Terracotta balcony planter filled with leafy herbs' }],
  },
  {
    name: 'The Kitchen Garden Seeds', slug: 'the-kitchen-garden-seeds', sku: 'RW-SEEDS-01', category: 'Seeds',
    priceCents: 1800, inventory: 45, featured: true, badge: '',
    description: 'Start with a seed, end with something worth sharing. This little collection brings basil, cherry tomatoes, and radishes to your windowsill or balcony. An invitation to slow down, get your hands into the soil, and see what happens.',
    highlights: ['Three seed varieties: basil, cherry tomato, and radish', 'A satisfying starting point for a small edible garden', 'Growing conditions and harvest times vary by variety'],
    images: [{ url: '/images/seeds.jpg', alt: 'Three botanical kraft-paper seed packets with a sprig of herbs' }],
  },
  {
    name: 'The Countertop Garden', slug: 'the-countertop-garden', sku: 'RW-KIT-01', category: 'Growing kits',
    priceCents: 12900, inventory: 8, featured: true, badge: 'New',
    description: 'A little green company for your kitchen. A softly glowing lamp and a pair of terracotta pots bring your growing ritual indoors. Give your favorite herbs a dedicated place, even when your apartment does not have a garden.',
    highlights: ['Compact growing lamp with two terracotta pots', 'Warm-white light and an olive-green finish', 'Seeds and growing medium sold separately'],
    images: [{ url: '/images/light.jpg', alt: 'Olive-green growing lamp over two small terracotta herb pots' }],
  },
  {
    name: 'The Everyday Tool Set', slug: 'the-everyday-tool-set', sku: 'RW-TOOLS-01', category: 'Tools & care',
    priceCents: 3200, inventory: 24, featured: false, badge: '',
    description: 'Two good tools. A hundred little reasons to get outside. A hand trowel and fork with smooth wood handles make planting, potting, and everyday tending a small pleasure. Keep them close to your favorite patch of green.',
    highlights: ['A hand trowel and three-prong hand fork', 'Smooth ash-wood handles with hanging loops', 'Compact tools for containers and small gardens'],
    images: [{ url: '/images/tools.jpg', alt: 'Wood-handled steel garden trowel and hand fork' }],
  },
  {
    name: 'The Slow Pour', slug: 'the-slow-pour', sku: 'RW-WATER-01', category: 'Tools & care',
    priceCents: 3800, compareAtPriceCents: 4800, inventory: 4, featured: false, badge: '',
    description: 'Make watering a moment, not a chore. This little forest-green watering can has a long, slender spout for reaching between leaves and into small pots. Useful enough for every day; lovely enough to leave out.',
    highlights: ['One-liter capacity', 'Slender spout for watering small containers', 'Matte forest-green metal finish'],
    images: [{ url: '/images/water.jpg', alt: 'Forest-green metal watering can with a long slender spout' }],
  },
  {
    name: 'The Windowsill Greens Kit', slug: 'the-windowsill-greens-kit', sku: 'RW-GREENS-01', category: 'Growing kits',
    priceCents: 4200, inventory: 0, featured: false, badge: 'New',
    description: 'A small tray with big potential. Start your own little crop of fresh microgreens in a pair of speckled ceramic growing trays. Made for the kitchen windowsill, a bright shelf, or any spot that could use a little life.',
    highlights: ['Two matching speckled ceramic growing trays', 'A compact introduction to growing microgreens', 'Includes radish microgreen seeds and growing medium'],
    images: [{ url: '/images/greens.jpg', alt: 'Speckled ceramic trays with fresh radish microgreens' }],
  },
].map(product => ({ currency: 'usd', status: 'active', compareAtPriceCents: null, ...product }))
