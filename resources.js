// data/biomes.json
var biomes_default = {
  database: "wildwillows",
  table: "Biome",
  records: [
    {
      id: "meadow",
      name: "Willow Meadow",
      order: 1,
      explorable: true,
      description: "A once-flowering meadow beside your home, now dusty and quiet. Native grasses were stripped away and the pollinators left with them.",
      restorationGoal: "Replant grasses and wildflowers, add water and shelter, and help 10 meadow animals return.",
      unlock: null,
      resources: [
        "seeds",
        "berries",
        "stones",
        "branches",
        "wildflowers",
        "fiber",
        "water"
      ],
      digResources: [
        "clay",
        "clay",
        "clay",
        "stones"
      ],
      palette: {
        damaged: "#b9a37c",
        healthy: "#8fbf6f"
      },
      grid: {
        cols: 44,
        rows: 26
      }
    },
    {
      id: "forest",
      name: "Old Hollow Forest",
      order: 2,
      explorable: true,
      description: "A logged-over woodland. The big trees are gone, the understory is bare, and the birds have moved on.",
      restorationGoal: "Rebuild the understory, raise nesting trees and deadwood, and welcome the forest animals back.",
      unlock: {
        biome: "meadow",
        minHealth: 60,
        minAnimals: 10,
        requiresItem: "forest-restoration-kit",
        label: "Restore Willow Meadow to 60% health, welcome 10 meadow animals, and craft a Forest Restoration Kit."
      },
      resources: [
        "branches",
        "mushrooms",
        "pinecones",
        "acorns",
        "bark",
        "moss",
        "berries",
        "stones",
        "water"
      ],
      digResources: [
        "clay",
        "clay",
        "stones"
      ],
      palette: {
        damaged: "#9c8a66",
        healthy: "#5e9455"
      },
      grid: {
        cols: 30,
        rows: 26
      }
    },
    {
      id: "wetland",
      name: "Rushwater Wetland",
      order: 3,
      explorable: true,
      description: "A drained marsh. Old channels are dry, the reeds are gone, and the water that remains is murky.",
      restorationGoal: "Restore shallow water, reed beds, and mud banks so wetland life can return.",
      unlock: {
        biome: "forest",
        minHealth: 80,
        minAnimals: 10,
        minTotalAnimals: 25,
        requiresItem: "wetland-restoration-kit",
        label: "Restore Old Hollow Forest to 80% health with 10 forest animals back, welcome 25 animals across the whole preserve, and craft a Wetland Restoration Kit."
      },
      resources: [
        "reeds",
        "clay",
        "mud",
        "clean-water",
        "water",
        "fiber"
      ],
      digResources: [
        "clay",
        "mud",
        "mud",
        "stones"
      ],
      palette: {
        damaged: "#a8a07a",
        healthy: "#6aa884"
      },
      grid: {
        cols: 30,
        rows: 26
      }
    },
    {
      id: "desert",
      name: "Redstone Scrubland",
      order: 4,
      explorable: true,
      description: "An overgrazed desert flat. Without brush or burrows, the heat keeps everything away.",
      restorationGoal: "Replant cactus and brush, build shade and burrows, and bring the desert back to life.",
      unlock: {
        biome: "wetland",
        minHealth: 80,
        minAnimals: 13,
        minTotalAnimals: 45,
        requiresItem: "scrubland-restoration-kit",
        label: "Restore Rushwater Wetland to 80% health with 13 wetland animals back, welcome 45 animals across the whole preserve, and craft a Scrubland Restoration Kit."
      },
      resources: [
        "sand",
        "cactus-fruit",
        "stones",
        "clay",
        "geode",
        "agave-nectar"
      ],
      digResources: [
        "sand",
        "sand",
        "clay",
        "stones",
        "geode"
      ],
      palette: {
        damaged: "#c78a52",
        healthy: "#e08a3c"
      },
      canFlood: false,
      grid: {
        cols: 30,
        rows: 26
      }
    },
    {
      id: "alpine",
      name: "Graywind Heights",
      order: 5,
      explorable: true,
      description: "A trampled alpine slope. The wildflower turf is worn through and the talus is silent.",
      restorationGoal: "Restore alpine turf, snowmelt pools, and rocky shelter for high-country animals.",
      unlock: {
        biome: "desert",
        minHealth: 80,
        minAnimals: 15,
        minTotalAnimals: 65,
        requiresItem: "alpine-restoration-kit",
        label: "Restore Redstone Scrubland to 80% health with 15 desert animals back, welcome 65 animals across the whole preserve, and craft an Alpine Restoration Kit."
      },
      resources: [
        "alpine-flowers",
        "stones",
        "moss",
        "clean-water",
        "quartz-crystal",
        "pine-nuts",
        "lichen",
        "snow",
        "juniper-berries",
        "obsidian"
      ],
      digResources: [
        "stones",
        "stones",
        "clay",
        "obsidian",
        "quartz-crystal"
      ],
      palette: {
        damaged: "#9a9992",
        healthy: "#a6ad93"
      },
      grid: {
        cols: 30,
        rows: 26
      }
    },
    {
      id: "coastal",
      name: "Pelican Shore",
      order: 6,
      explorable: true,
      description: "A scoured stretch of coast where the open ocean breaks along the eastern edge. The dunes have washed out and the tidepools are empty, but sea glass, kelp, coral, and the odd pearl still wash up on the tide.",
      restorationGoal: "Anchor the dunes, restore tidepools and kelp wrack, and reopen the shore to coastal life.",
      unlock: {
        biome: "alpine",
        minHealth: 80,
        minAnimals: 17,
        minTotalAnimals: 85,
        requiresItem: "migration-path-marker",
        label: "Restore Graywind Heights to 80% health with 17 alpine animals back, welcome 85 animals across the whole preserve, and craft a Migration Path Marker."
      },
      resources: [
        "shells",
        "driftwood",
        "sand",
        "water",
        "kelp",
        "sea-glass",
        "coral",
        "pearl"
      ],
      digResources: [
        "sand",
        "sand",
        "shells",
        "coral"
      ],
      palette: {
        damaged: "#c2b9a0",
        healthy: "#e8d9a8"
      },
      grid: {
        cols: 36,
        rows: 26
      },
      oceanCols: 10
    }
  ]
};

// data/recipes.json
var recipes_default = {
  database: "wildwillows",
  table: "Recipe",
  records: [
    {
      id: "grass-patch",
      name: "Grass Patch",
      category: "habitat",
      unlockBiome: "meadow",
      output: {
        itemId: "grass-patch",
        qty: 1
      },
      materials: {
        seeds: 1,
        fiber: 1
      }
    },
    {
      id: "native-grass-patch",
      name: "Native Grass Patch",
      category: "habitat",
      unlockBiome: "meadow",
      output: {
        itemId: "native-grass-patch",
        qty: 1
      },
      materials: {
        seeds: 4,
        fiber: 2,
        water: 1
      }
    },
    {
      id: "wildflower-patch",
      name: "Wildflower Patch",
      category: "habitat",
      unlockBiome: "meadow",
      output: {
        itemId: "wildflower-patch",
        qty: 1
      },
      materials: {
        wildflowers: 3,
        seeds: 2,
        water: 1
      }
    },
    {
      id: "butterfly-flowers",
      name: "Butterfly Flowers",
      category: "habitat",
      unlockBiome: "meadow",
      output: {
        itemId: "butterfly-flowers",
        qty: 1
      },
      materials: {
        wildflowers: 4,
        seeds: 1
      },
      unlock: {
        requiresAnimal: "grasshopper",
        label: "Welcome the grasshopper back to Willow Meadow"
      }
    },
    {
      id: "pollinator-garden",
      name: "Pollinator Garden",
      category: "habitat",
      unlockBiome: "meadow",
      output: {
        itemId: "pollinator-garden",
        qty: 1
      },
      materials: {
        wildflowers: 4,
        seeds: 3,
        water: 2,
        fiber: 1
      },
      unlock: {
        minHealth: 22,
        label: "Restore Willow Meadow to 22% health"
      }
    },
    {
      id: "shrub",
      name: "Shrub",
      category: "habitat",
      unlockBiome: "meadow",
      output: {
        itemId: "shrub",
        qty: 1
      },
      materials: {
        branches: 2,
        seeds: 2,
        water: 1
      },
      unlock: {
        minHealth: 10,
        label: "Restore Willow Meadow to 10% health"
      }
    },
    {
      id: "berry-bush",
      name: "Berry Bush",
      category: "habitat",
      unlockBiome: "meadow",
      output: {
        itemId: "berry-bush",
        qty: 1
      },
      materials: {
        berries: 4,
        seeds: 2,
        water: 1
      },
      unlock: {
        minHealth: 25,
        label: "Restore Willow Meadow to 25% health"
      }
    },
    {
      id: "small-pond",
      name: "Small Pond",
      category: "habitat",
      unlockBiome: "meadow",
      output: {
        itemId: "small-pond",
        qty: 1
      },
      materials: {
        stones: 6,
        clay: 4,
        water: 4
      },
      unlock: {
        minHealth: 35,
        label: "Restore Willow Meadow to 35% health"
      }
    },
    {
      id: "shallow-water-pool",
      name: "Shallow Water Pool",
      category: "habitat",
      unlockBiome: "meadow",
      output: {
        itemId: "shallow-water-pool",
        qty: 1
      },
      materials: {
        clay: 3,
        stones: 3,
        water: 3
      },
      unlock: {
        minHealth: 38,
        label: "Restore Willow Meadow to 38% health"
      }
    },
    {
      id: "log-shelter",
      name: "Log Shelter",
      category: "habitat",
      unlockBiome: "meadow",
      output: {
        itemId: "log-shelter",
        qty: 1
      },
      materials: {
        branches: 6,
        fiber: 2
      },
      unlock: {
        minHealth: 40,
        label: "Restore Willow Meadow to 40% health"
      }
    },
    {
      id: "hollow-log",
      name: "Hollow Log",
      category: "habitat",
      unlockBiome: "meadow",
      output: {
        itemId: "hollow-log",
        qty: 1
      },
      materials: {
        branches: 8,
        fiber: 3
      },
      unlock: {
        minHealth: 42,
        label: "Restore Willow Meadow to 42% health"
      }
    },
    {
      id: "rock-pile",
      name: "Rock Pile",
      category: "habitat",
      unlockBiome: "meadow",
      output: {
        itemId: "rock-pile",
        qty: 1
      },
      materials: {
        stones: 5
      },
      unlock: {
        minHealth: 6,
        label: "Restore Willow Meadow to 6% health"
      }
    },
    {
      id: "fallen-branch-shelter",
      name: "Fallen Branch Shelter",
      category: "habitat",
      unlockBiome: "meadow",
      output: {
        itemId: "fallen-branch-shelter",
        qty: 1
      },
      materials: {
        branches: 4,
        fiber: 2
      },
      unlock: {
        minHealth: 44,
        label: "Restore Willow Meadow to 44% health"
      }
    },
    {
      id: "bird-perch",
      name: "Bird Perch",
      category: "habitat",
      unlockBiome: "meadow",
      output: {
        itemId: "bird-perch",
        qty: 1
      },
      materials: {
        branches: 3,
        fiber: 1
      },
      unlock: {
        minHealth: 8,
        label: "Restore Willow Meadow to 8% health"
      }
    },
    {
      id: "simple-path",
      name: "Stepping-Stone Path",
      category: "decoration",
      unlockBiome: "meadow",
      output: {
        itemId: "simple-path",
        qty: 2
      },
      materials: {
        stones: 2
      }
    },
    {
      id: "gravel-path",
      name: "Gravel Path",
      category: "decoration",
      unlockBiome: "meadow",
      output: {
        itemId: "gravel-path",
        qty: 2
      },
      materials: {
        stones: 2
      },
      unlock: {
        minHealth: 50,
        label: "Restore Willow Meadow to 50% health"
      }
    },
    {
      id: "plank-path",
      name: "Plank Path",
      category: "decoration",
      unlockBiome: "meadow",
      output: {
        itemId: "plank-path",
        qty: 2
      },
      materials: {
        branches: 2
      },
      unlock: {
        minHealth: 52,
        label: "Restore Willow Meadow to 52% health"
      }
    },
    {
      id: "flagstone-path",
      name: "Flagstone Path",
      category: "decoration",
      unlockBiome: "meadow",
      output: {
        itemId: "flagstone-path",
        qty: 2
      },
      materials: {
        stones: 3,
        clay: 1
      },
      unlock: {
        minHealth: 53,
        label: "Restore Willow Meadow to 53% health"
      }
    },
    {
      id: "mossy-path",
      name: "Mossy Path",
      category: "decoration",
      unlockBiome: "forest",
      output: {
        itemId: "mossy-path",
        qty: 2
      },
      materials: {
        stones: 2,
        moss: 1
      }
    },
    {
      id: "wooden-bridge",
      name: "Wooden Bridge",
      category: "decoration",
      unlockBiome: "meadow",
      output: {
        itemId: "wooden-bridge",
        qty: 1
      },
      materials: {
        branches: 4,
        stones: 1,
        fiber: 1
      },
      unlock: {
        minHealth: 57,
        label: "Restore Willow Meadow to 57% health"
      }
    },
    {
      id: "small-chest",
      name: "Small Chest",
      category: "storage",
      unlockBiome: "meadow",
      output: {
        itemId: "small-chest",
        qty: 1
      },
      materials: {
        branches: 5,
        fiber: 2,
        stones: 1
      }
    },
    {
      id: "medium-chest",
      name: "Medium Chest",
      category: "storage",
      unlockBiome: "forest",
      output: {
        itemId: "medium-chest",
        qty: 1
      },
      materials: {
        branches: 8,
        bark: 3,
        fiber: 3
      }
    },
    {
      id: "field-journal-stand",
      name: "Field Journal Stand",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "field-journal-stand",
        qty: 1
      },
      materials: {
        branches: 4,
        stones: 2
      },
      unlock: {
        minHealth: 67,
        label: "Restore Willow Meadow to 67% health"
      }
    },
    {
      id: "flower-vase",
      name: "Potted Flowers",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "flower-vase",
        qty: 1
      },
      materials: {
        clay: 3,
        wildflowers: 2
      },
      unlock: {
        minHealth: 60,
        label: "Restore Willow Meadow to 60% health"
      }
    },
    {
      id: "nesting-tree",
      name: "Nesting Tree",
      category: "habitat",
      unlockBiome: "forest",
      output: {
        itemId: "nesting-tree",
        qty: 1
      },
      materials: {
        acorns: 3,
        water: 2,
        clay: 1
      },
      unlock: {
        minHealth: 14,
        label: "Restore Old Hollow Forest to 14% health"
      }
    },
    {
      id: "woodland-pool",
      name: "Woodland Pool",
      category: "habitat",
      unlockBiome: "forest",
      output: {
        itemId: "woodland-pool",
        qty: 1
      },
      materials: {
        clay: 4,
        stones: 2,
        water: 5
      },
      unlock: {
        minHealth: 57,
        label: "Restore Old Hollow Forest to 57% health"
      }
    },
    {
      id: "fern-spring",
      name: "Fern Spring",
      category: "habitat",
      unlockBiome: "forest",
      output: {
        itemId: "fern-spring",
        qty: 1
      },
      materials: {
        moss: 3,
        branches: 2,
        water: 3
      },
      unlock: {
        minHealth: 66,
        label: "Restore Old Hollow Forest to 66% health"
      }
    },
    {
      id: "standing-deadwood",
      name: "Standing Deadwood",
      category: "habitat",
      unlockBiome: "forest",
      output: {
        itemId: "standing-deadwood",
        qty: 1
      },
      materials: {
        branches: 6,
        bark: 2
      },
      unlock: {
        minHealth: 12,
        label: "Restore Old Hollow Forest to 12% health"
      }
    },
    {
      id: "mushroom-log",
      name: "Mushroom Log",
      category: "habitat",
      unlockBiome: "forest",
      output: {
        itemId: "mushroom-log",
        qty: 1
      },
      materials: {
        branches: 4,
        mushrooms: 3,
        moss: 2
      },
      unlock: {
        minHealth: 22,
        label: "Restore Old Hollow Forest to 22% health"
      }
    },
    {
      id: "wetland-restoration-kit",
      name: "Wetland Restoration Kit",
      category: "kit",
      unlockBiome: "forest",
      output: {
        itemId: "wetland-restoration-kit",
        qty: 1
      },
      materials: {
        stones: 5,
        clay: 5,
        fiber: 6,
        water: 6,
        moss: 3,
        bark: 2
      },
      once: true
    },
    {
      id: "reed-bed",
      name: "Reed Bed",
      category: "habitat",
      unlockBiome: "wetland",
      output: {
        itemId: "reed-bed",
        qty: 1
      },
      materials: {
        reeds: 5,
        mud: 2
      }
    },
    {
      id: "mud-bank",
      name: "Mud Bank",
      category: "habitat",
      unlockBiome: "wetland",
      requiresTool: {
        id: "shovel",
        tier: 2
      },
      output: {
        itemId: "mud-bank",
        qty: 1
      },
      materials: {
        mud: 6,
        clay: 2
      },
      unlock: {
        minHealth: 72,
        label: "Restore Rushwater Wetland to 72% health"
      }
    },
    {
      id: "nesting-platform",
      name: "Nesting Platform",
      category: "habitat",
      unlockBiome: "wetland",
      output: {
        itemId: "nesting-platform",
        qty: 1
      },
      materials: {
        branches: 6,
        reeds: 3
      },
      unlock: {
        minHealth: 57,
        label: "Restore Rushwater Wetland to 57% health"
      }
    },
    {
      id: "cattail-stand",
      name: "Cattail Stand",
      category: "habitat",
      unlockBiome: "wetland",
      output: {
        itemId: "cattail-stand",
        qty: 1
      },
      materials: {
        reeds: 4,
        mud: 1
      },
      unlock: {
        minHealth: 18,
        label: "Restore Rushwater Wetland to 18% health"
      }
    },
    {
      id: "marsh-log",
      name: "Marsh Log",
      category: "habitat",
      unlockBiome: "wetland",
      output: {
        itemId: "marsh-log",
        qty: 1
      },
      materials: {
        branches: 5,
        mud: 2
      },
      unlock: {
        minHealth: 22,
        label: "Restore Rushwater Wetland to 22% health"
      }
    },
    {
      id: "lily-pool",
      name: "Lily Pool",
      category: "habitat",
      unlockBiome: "wetland",
      output: {
        itemId: "lily-pool",
        qty: 1
      },
      materials: {
        reeds: 2,
        clay: 2,
        "clean-water": 2
      },
      unlock: {
        minHealth: 45,
        label: "Restore Rushwater Wetland to 45% health"
      }
    },
    {
      id: "burrow-mound",
      name: "Burrow Mound",
      category: "habitat",
      unlockBiome: "desert",
      requiresTool: {
        id: "shovel",
        tier: 2
      },
      output: {
        itemId: "burrow-mound",
        qty: 1
      },
      materials: {
        sand: 4,
        clay: 2,
        stones: 2
      }
    },
    {
      id: "cactus-patch",
      name: "Cactus Patch",
      category: "habitat",
      unlockBiome: "desert",
      output: {
        itemId: "cactus-patch",
        qty: 1
      },
      materials: {
        "cactus-fruit": 3,
        sand: 2,
        stones: 1
      }
    },
    {
      id: "desert-brush",
      name: "Desert Brush",
      category: "habitat",
      unlockBiome: "desert",
      output: {
        itemId: "desert-brush",
        qty: 1
      },
      materials: {
        branches: 2,
        "cactus-fruit": 1,
        sand: 2
      }
    },
    {
      id: "shaded-rock-shelter",
      name: "Shaded Rock Shelter",
      category: "habitat",
      unlockBiome: "desert",
      output: {
        itemId: "shaded-rock-shelter",
        qty: 1
      },
      materials: {
        stones: 8,
        sand: 2
      },
      unlock: {
        minHealth: 12,
        label: "Restore Redstone Scrubland to 12% health"
      }
    },
    {
      id: "alpine-wildflower-patch",
      name: "Alpine Wildflower Patch",
      category: "habitat",
      unlockBiome: "alpine",
      output: {
        itemId: "alpine-wildflower-patch",
        qty: 1
      },
      materials: {
        "alpine-flowers": 4,
        seeds: 1,
        "clean-water": 1
      }
    },
    {
      id: "snowmelt-pool",
      name: "Snowmelt Pool",
      category: "habitat",
      unlockBiome: "alpine",
      output: {
        itemId: "snowmelt-pool",
        qty: 1
      },
      materials: {
        stones: 5,
        "clean-water": 4
      },
      unlock: {
        minHealth: 65,
        label: "Restore Graywind Heights to 65% health"
      }
    },
    {
      id: "migration-path-marker",
      name: "Migration Path Marker",
      category: "kit",
      unlockBiome: "alpine",
      output: {
        itemId: "migration-path-marker",
        qty: 1
      },
      materials: {
        stones: 8,
        "alpine-flowers": 5,
        fiber: 4,
        "quartz-crystal": 2
      },
      once: true
    },
    {
      id: "tidepool",
      name: "Tidepool",
      category: "habitat",
      unlockBiome: "coastal",
      output: {
        itemId: "tidepool",
        qty: 1
      },
      materials: {
        stones: 6,
        sand: 3,
        water: 3
      }
    },
    {
      id: "dune-grass",
      name: "Dune Grass",
      category: "habitat",
      unlockBiome: "coastal",
      output: {
        itemId: "dune-grass",
        qty: 1
      },
      materials: {
        seeds: 3,
        sand: 3,
        fiber: 1
      }
    },
    {
      id: "driftwood-shelter",
      name: "Driftwood Shelter",
      category: "habitat",
      unlockBiome: "coastal",
      output: {
        itemId: "driftwood-shelter",
        qty: 1
      },
      materials: {
        driftwood: 5,
        fiber: 2
      },
      unlock: {
        minHealth: 14,
        label: "Restore Pelican Shore to 14% health"
      }
    },
    {
      id: "kelp-wrack",
      name: "Kelp Wrack",
      category: "habitat",
      unlockBiome: "coastal",
      output: {
        itemId: "kelp-wrack",
        qty: 1
      },
      materials: {
        driftwood: 2,
        shells: 1,
        water: 2
      }
    },
    {
      id: "coastal-nesting-area",
      name: "Coastal Nesting Area",
      category: "habitat",
      unlockBiome: "coastal",
      output: {
        itemId: "coastal-nesting-area",
        qty: 1
      },
      materials: {
        driftwood: 4,
        sand: 4,
        fiber: 2
      },
      unlock: {
        minHealth: 65,
        label: "Restore Pelican Shore to 65% health"
      }
    },
    {
      id: "coral-garden",
      name: "Coral Garden",
      category: "habitat",
      unlockBiome: "coastal",
      output: {
        itemId: "coral-garden",
        qty: 1
      },
      materials: {
        coral: 4,
        kelp: 3,
        stones: 2,
        water: 2
      },
      unlock: {
        minHealth: 40,
        label: "Restore Pelican Shore to 40% health"
      }
    },
    {
      id: "sea-glass-lantern",
      name: "Sea Glass Lantern",
      category: "structure",
      unlockBiome: "coastal",
      output: {
        itemId: "sea-glass-lantern",
        qty: 1
      },
      materials: {
        "sea-glass": 4,
        driftwood: 2
      },
      unlock: {
        minHealth: 30,
        label: "Restore Pelican Shore to 30% health"
      }
    },
    {
      id: "tide-chime",
      name: "Tide Chime",
      category: "home",
      unlockBiome: "coastal",
      output: {
        itemId: "tide-chime",
        qty: 1
      },
      materials: {
        "sea-glass": 2,
        shells: 3,
        driftwood: 1
      },
      unlock: {
        minHealth: 50,
        label: "Restore Pelican Shore to 50% health"
      }
    },
    {
      id: "pearl-display",
      name: "Pearl Display",
      category: "structure",
      unlockBiome: "coastal",
      output: {
        itemId: "pearl-display",
        qty: 1
      },
      materials: {
        pearl: 2,
        shells: 5,
        driftwood: 2
      },
      unlock: {
        minHealth: 72,
        label: "Restore Pelican Shore to 72% health"
      }
    },
    {
      id: "sea-glass-path",
      name: "Sea Glass Path",
      category: "decoration",
      unlockBiome: "coastal",
      output: {
        itemId: "sea-glass-path",
        qty: 1
      },
      materials: {
        "sea-glass": 2,
        sand: 2
      }
    },
    {
      id: "forest-restoration-kit",
      name: "Forest Restoration Kit",
      category: "kit",
      unlockBiome: "meadow",
      once: true,
      output: {
        itemId: "forest-restoration-kit",
        qty: 1
      },
      materials: {
        fiber: 8,
        branches: 8,
        stones: 6,
        water: 4
      }
    },
    {
      id: "scrubland-restoration-kit",
      name: "Scrubland Restoration Kit",
      category: "kit",
      unlockBiome: "wetland",
      once: true,
      output: {
        itemId: "scrubland-restoration-kit",
        qty: 1
      },
      materials: {
        reeds: 8,
        mud: 6,
        clay: 5,
        "clean-water": 5
      }
    },
    {
      id: "alpine-restoration-kit",
      name: "Alpine Restoration Kit",
      category: "kit",
      unlockBiome: "desert",
      once: true,
      output: {
        itemId: "alpine-restoration-kit",
        qty: 1
      },
      materials: {
        sand: 8,
        stones: 7,
        clay: 5,
        "cactus-fruit": 3,
        geode: 1
      }
    },
    {
      id: "stone-lantern",
      name: "Stone Lantern",
      category: "structure",
      unlockBiome: "meadow",
      output: {
        itemId: "stone-lantern",
        qty: 1
      },
      materials: {
        stones: 4,
        clay: 2
      },
      unlock: {
        minHealth: 71,
        label: "Restore Willow Meadow to 71% health"
      }
    },
    {
      id: "wooden-bench",
      name: "Wooden Bench",
      category: "structure",
      unlockBiome: "meadow",
      output: {
        itemId: "wooden-bench",
        qty: 1
      },
      materials: {
        branches: 5,
        fiber: 2
      },
      unlock: {
        minHealth: 73,
        label: "Restore Willow Meadow to 73% health"
      }
    },
    {
      id: "garden-arch",
      name: "Garden Arch",
      category: "structure",
      unlockBiome: "meadow",
      output: {
        itemId: "garden-arch",
        qty: 1
      },
      materials: {
        branches: 4,
        wildflowers: 3,
        fiber: 1
      },
      unlock: {
        minHealth: 74,
        label: "Restore Willow Meadow to 74% health"
      }
    },
    {
      id: "bird-bath",
      name: "Bird Bath",
      category: "structure",
      unlockBiome: "meadow",
      output: {
        itemId: "bird-bath",
        qty: 1
      },
      materials: {
        stones: 5,
        clay: 2,
        water: 2
      },
      unlock: {
        minHealth: 58,
        label: "Restore Willow Meadow to 58% health"
      }
    },
    {
      id: "trail-signpost",
      name: "Trail Signpost",
      category: "structure",
      unlockBiome: "meadow",
      output: {
        itemId: "trail-signpost",
        qty: 1
      },
      materials: {
        branches: 3,
        stones: 1
      },
      unlock: {
        minHealth: 76,
        label: "Restore Willow Meadow to 76% health"
      }
    },
    {
      id: "planter-box",
      name: "Planter Box",
      category: "structure",
      unlockBiome: "meadow",
      output: {
        itemId: "planter-box",
        qty: 1
      },
      materials: {
        branches: 3,
        wildflowers: 2,
        clay: 1
      },
      unlock: {
        minHealth: 65,
        label: "Restore Willow Meadow to 65% health"
      }
    },
    {
      id: "gazebo",
      name: "Gazebo",
      category: "structure",
      unlockBiome: "meadow",
      output: {
        itemId: "gazebo",
        qty: 1
      },
      materials: {
        branches: 10,
        stones: 5,
        fiber: 4
      },
      unlock: {
        minHealth: 77,
        label: "Restore Willow Meadow to 77% health"
      }
    },
    {
      id: "clover-patch",
      name: "Clover Patch",
      category: "habitat",
      unlockBiome: "meadow",
      output: {
        itemId: "clover-patch",
        qty: 1
      },
      materials: {
        seeds: 3,
        water: 1
      },
      unlock: {
        minHealth: 12,
        label: "Restore Willow Meadow to 12% health"
      }
    },
    {
      id: "brush-pile",
      name: "Brush Pile",
      category: "habitat",
      unlockBiome: "meadow",
      output: {
        itemId: "brush-pile",
        qty: 1
      },
      materials: {
        branches: 4,
        fiber: 2
      },
      unlock: {
        minHealth: 14,
        label: "Restore Willow Meadow to 14% health"
      }
    },
    {
      id: "fern-grove",
      name: "Fern Grove",
      category: "habitat",
      unlockBiome: "forest",
      output: {
        itemId: "fern-grove",
        qty: 1
      },
      materials: {
        moss: 3,
        water: 2
      },
      unlock: {
        minHealth: 46,
        label: "Restore Old Hollow Forest to 46% health"
      }
    },
    {
      id: "tree-stump",
      name: "Tree Stump",
      category: "habitat",
      unlockBiome: "forest",
      output: {
        itemId: "tree-stump",
        qty: 1
      },
      materials: {
        branches: 4,
        bark: 2
      },
      unlock: {
        minHealth: 32,
        label: "Restore Old Hollow Forest to 32% health"
      }
    },
    {
      id: "sedge-tussock",
      name: "Sedge Tussock",
      category: "habitat",
      unlockBiome: "wetland",
      output: {
        itemId: "sedge-tussock",
        qty: 1
      },
      materials: {
        reeds: 4,
        mud: 1
      }
    },
    {
      id: "alder-snag",
      name: "Alder Snag",
      category: "habitat",
      unlockBiome: "wetland",
      output: {
        itemId: "alder-snag",
        qty: 1
      },
      materials: {
        branches: 5,
        mud: 1
      },
      unlock: {
        minHealth: 65,
        label: "Restore Rushwater Wetland to 65% health"
      }
    },
    {
      id: "agave-rosette",
      name: "Agave Rosette",
      category: "habitat",
      unlockBiome: "desert",
      output: {
        itemId: "agave-rosette",
        qty: 1
      },
      materials: {
        "cactus-fruit": 2,
        sand: 2
      },
      unlock: {
        minHealth: 45,
        label: "Restore Redstone Scrubland to 45% health"
      }
    },
    {
      id: "ocotillo",
      name: "Ocotillo",
      category: "habitat",
      unlockBiome: "desert",
      output: {
        itemId: "ocotillo",
        qty: 1
      },
      materials: {
        branches: 2,
        sand: 2,
        "cactus-fruit": 1
      },
      unlock: {
        minHealth: 57,
        label: "Restore Redstone Scrubland to 57% health"
      }
    },
    {
      id: "heather-mat",
      name: "Heather Mat",
      category: "habitat",
      unlockBiome: "alpine",
      output: {
        itemId: "heather-mat",
        qty: 1
      },
      materials: {
        "alpine-flowers": 3,
        moss: 1
      },
      unlock: {
        minHealth: 14,
        label: "Restore Graywind Heights to 14% health"
      }
    },
    {
      id: "krummholz-pine",
      name: "Krummholz Pine",
      category: "habitat",
      unlockBiome: "alpine",
      output: {
        itemId: "krummholz-pine",
        qty: 1
      },
      materials: {
        branches: 4,
        moss: 2
      },
      unlock: {
        minHealth: 45,
        label: "Restore Graywind Heights to 45% health"
      }
    },
    {
      id: "eelgrass-bed",
      name: "Eelgrass Bed",
      category: "habitat",
      unlockBiome: "coastal",
      output: {
        itemId: "eelgrass-bed",
        qty: 1
      },
      materials: {
        driftwood: 2,
        sand: 2,
        water: 2
      },
      unlock: {
        minHealth: 78,
        label: "Restore Pelican Shore to 78% health"
      }
    },
    {
      id: "oyster-bed",
      name: "Oyster Bed",
      category: "habitat",
      unlockBiome: "coastal",
      output: {
        itemId: "oyster-bed",
        qty: 1
      },
      materials: {
        shells: 3,
        stones: 2
      },
      unlock: {
        minHealth: 22,
        label: "Restore Pelican Shore to 22% health"
      }
    },
    {
      id: "nectar-feeder",
      name: "Nectar Feeder",
      category: "habitat",
      unlockBiome: "desert",
      output: {
        itemId: "nectar-feeder",
        qty: 1
      },
      materials: {
        "agave-nectar": 2,
        branches: 2
      },
      unlock: {
        minHealth: 16,
        label: "Restore Redstone Scrubland to 16% health"
      }
    },
    {
      id: "crystal-cairn",
      name: "Crystal Cairn",
      category: "structure",
      unlockBiome: "desert",
      output: {
        itemId: "crystal-cairn",
        qty: 1
      },
      materials: {
        geode: 2,
        stones: 3
      },
      unlock: {
        minHealth: 40,
        label: "Restore Redstone Scrubland to 40% health"
      }
    },
    {
      id: "sun-totem",
      name: "Sun Totem",
      category: "structure",
      unlockBiome: "desert",
      output: {
        itemId: "sun-totem",
        qty: 1
      },
      materials: {
        geode: 1,
        stones: 4,
        sand: 2
      },
      unlock: {
        minHealth: 72,
        label: "Restore Redstone Scrubland to 72% health"
      }
    },
    {
      id: "campfire",
      name: "Campfire",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "campfire",
        qty: 1
      },
      materials: {
        branches: 4,
        stones: 3
      },
      unlock: {
        minHealth: 55,
        label: "Restore Willow Meadow to 55% health"
      }
    },
    {
      id: "string-lights",
      name: "String Lights",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "string-lights",
        qty: 1
      },
      materials: {
        fiber: 3,
        branches: 2
      },
      unlock: {
        minHealth: 48,
        label: "Restore Willow Meadow to 48% health"
      }
    },
    {
      id: "pinwheel",
      name: "Pinwheel",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "pinwheel",
        qty: 1
      },
      materials: {
        fiber: 2,
        branches: 1
      },
      unlock: {
        minHealth: 46,
        label: "Restore Willow Meadow to 46% health"
      }
    },
    {
      id: "birdhouse",
      name: "Birdhouse",
      category: "structure",
      unlockBiome: "meadow",
      output: {
        itemId: "birdhouse",
        qty: 1
      },
      materials: {
        branches: 3,
        fiber: 1
      },
      unlock: {
        minHealth: 33,
        label: "Restore Willow Meadow to 33% health"
      }
    },
    {
      id: "flower-cart",
      name: "Flower Cart",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "flower-cart",
        qty: 1
      },
      materials: {
        branches: 4,
        wildflowers: 3
      },
      unlock: {
        minHealth: 72,
        label: "Restore Willow Meadow to 72% health"
      }
    },
    {
      id: "hammock",
      name: "Hammock",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "hammock",
        qty: 1
      },
      materials: {
        fiber: 5,
        branches: 2
      },
      unlock: {
        minHealth: 66,
        label: "Restore Willow Meadow to 66% health"
      }
    },
    {
      id: "garden-gnome",
      name: "Garden Gnome",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "garden-gnome",
        qty: 1
      },
      materials: {
        clay: 3
      },
      unlock: {
        minHealth: 70,
        label: "Restore Willow Meadow to 70% health"
      }
    },
    {
      id: "wind-chimes",
      name: "Wind Chimes",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "wind-chimes",
        qty: 1
      },
      materials: {
        branches: 2,
        stones: 2,
        fiber: 1
      },
      unlock: {
        minHealth: 69,
        label: "Restore Willow Meadow to 69% health"
      }
    },
    {
      id: "sundial",
      name: "Sundial",
      category: "structure",
      unlockBiome: "meadow",
      output: {
        itemId: "sundial",
        qty: 1
      },
      materials: {
        stones: 4,
        clay: 2
      },
      unlock: {
        minHealth: 75,
        label: "Restore Willow Meadow to 75% health"
      }
    },
    {
      id: "stone-cairn",
      name: "Stone Cairn",
      category: "structure",
      unlockBiome: "meadow",
      output: {
        itemId: "stone-cairn",
        qty: 1
      },
      materials: {
        stones: 6
      },
      unlock: {
        minHealth: 76,
        label: "Restore Willow Meadow to 76% health"
      }
    },
    {
      id: "picnic-blanket",
      name: "Picnic Blanket",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "picnic-blanket",
        qty: 1
      },
      materials: {
        fiber: 6
      },
      unlock: {
        minHealth: 64,
        label: "Restore Willow Meadow to 64% health"
      }
    },
    {
      id: "flower-pots",
      name: "Flower Pot Row",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "flower-pots",
        qty: 1
      },
      materials: {
        clay: 3,
        wildflowers: 2
      },
      unlock: {
        minHealth: 61,
        label: "Restore Willow Meadow to 61% health"
      }
    },
    {
      id: "insect-hotel",
      name: "Insect Hotel",
      category: "habitat",
      unlockBiome: "meadow",
      output: {
        itemId: "insect-hotel",
        qty: 1
      },
      materials: {
        branches: 4,
        fiber: 3,
        clay: 1
      },
      unlock: {
        minHealth: 30,
        label: "Restore Willow Meadow to 30% health"
      }
    },
    {
      id: "dry-stone-wall",
      name: "Dry Stone Wall",
      category: "habitat",
      unlockBiome: "meadow",
      output: {
        itemId: "dry-stone-wall",
        qty: 1
      },
      materials: {
        stones: 8
      },
      unlock: {
        minHealth: 36,
        label: "Restore Willow Meadow to 36% health"
      }
    },
    {
      id: "bat-box",
      name: "Bat Box",
      category: "habitat",
      unlockBiome: "forest",
      output: {
        itemId: "bat-box",
        qty: 1
      },
      materials: {
        branches: 5,
        bark: 2
      },
      unlock: {
        minHealth: 30,
        label: "Restore Old Hollow Forest to 30% health"
      }
    },
    {
      id: "leaf-litter-pile",
      name: "Leaf Litter Pile",
      category: "habitat",
      unlockBiome: "forest",
      output: {
        itemId: "leaf-litter-pile",
        qty: 1
      },
      materials: {
        moss: 2,
        branches: 2
      },
      unlock: {
        minHealth: 40,
        label: "Restore Old Hollow Forest to 40% health"
      }
    },
    {
      id: "duck-nest-box",
      name: "Duck Nest Box",
      category: "habitat",
      unlockBiome: "wetland",
      output: {
        itemId: "duck-nest-box",
        qty: 1
      },
      materials: {
        branches: 4,
        reeds: 2,
        fiber: 2
      },
      unlock: {
        minHealth: 35,
        label: "Restore Rushwater Wetland to 35% health"
      }
    },
    {
      id: "basking-log",
      name: "Basking Log",
      category: "habitat",
      unlockBiome: "wetland",
      output: {
        itemId: "basking-log",
        qty: 1
      },
      materials: {
        branches: 5,
        mud: 2
      },
      unlock: {
        minHealth: 45,
        label: "Restore Rushwater Wetland to 45% health"
      }
    },
    {
      id: "rock-crevice",
      name: "Rock Crevice",
      category: "habitat",
      unlockBiome: "desert",
      output: {
        itemId: "rock-crevice",
        qty: 1
      },
      materials: {
        stones: 6,
        clay: 2
      },
      unlock: {
        minHealth: 14,
        label: "Restore Redstone Scrubland to 14% health"
      }
    },
    {
      id: "dew-basin",
      name: "Dew Basin",
      category: "habitat",
      unlockBiome: "desert",
      output: {
        itemId: "dew-basin",
        qty: 1
      },
      materials: {
        clay: 4,
        stones: 4
      },
      unlock: {
        minHealth: 45,
        label: "Restore Redstone Scrubland to 45% health"
      }
    },
    {
      id: "talus-pile",
      name: "Talus Pile",
      category: "habitat",
      unlockBiome: "alpine",
      output: {
        itemId: "talus-pile",
        qty: 1
      },
      materials: {
        stones: 7
      },
      unlock: {
        minHealth: 12,
        label: "Restore Graywind Heights to 12% health"
      }
    },
    {
      id: "alpine-nest-shelf",
      name: "Nest Shelf",
      category: "habitat",
      unlockBiome: "alpine",
      output: {
        itemId: "alpine-nest-shelf",
        qty: 1
      },
      materials: {
        stones: 3,
        moss: 3
      },
      unlock: {
        minHealth: 45,
        label: "Restore Graywind Heights to 45% health"
      }
    },
    {
      id: "driftwood-pile",
      name: "Driftwood Pile",
      category: "habitat",
      unlockBiome: "coastal",
      output: {
        itemId: "driftwood-pile",
        qty: 1
      },
      materials: {
        driftwood: 3,
        shells: 2
      },
      unlock: {
        minHealth: 12,
        label: "Restore Pelican Shore to 12% health"
      }
    },
    {
      id: "nesting-bluff",
      name: "Nesting Bluff",
      category: "habitat",
      unlockBiome: "coastal",
      output: {
        itemId: "nesting-bluff",
        qty: 1
      },
      materials: {
        sand: 4,
        stones: 3
      },
      unlock: {
        minHealth: 45,
        label: "Restore Pelican Shore to 45% health"
      }
    },
    {
      id: "pika-haypile",
      name: "Pika Haypile",
      category: "habitat",
      unlockBiome: "alpine",
      output: {
        itemId: "pika-haypile",
        qty: 1
      },
      materials: {
        fiber: 3,
        "alpine-flowers": 2,
        lichen: 2
      },
      unlock: {
        minHealth: 18,
        label: "Restore Graywind Heights to 18% health"
      }
    },
    {
      id: "lichen-boulder",
      name: "Lichen Boulder",
      category: "habitat",
      unlockBiome: "alpine",
      output: {
        itemId: "lichen-boulder",
        qty: 1
      },
      materials: {
        lichen: 4,
        stones: 4
      },
      unlock: {
        minHealth: 16,
        label: "Restore Graywind Heights to 16% health"
      }
    },
    {
      id: "scree-slope",
      name: "Scree Slope",
      category: "habitat",
      unlockBiome: "alpine",
      output: {
        itemId: "scree-slope",
        qty: 1
      },
      materials: {
        stones: 6,
        lichen: 1
      },
      unlock: {
        minHealth: 20,
        label: "Restore Graywind Heights to 20% health"
      }
    },
    {
      id: "snowbank-roost",
      name: "Snowbank Roost",
      category: "habitat",
      unlockBiome: "alpine",
      output: {
        itemId: "snowbank-roost",
        qty: 1
      },
      materials: {
        snow: 5,
        "clean-water": 2
      },
      unlock: {
        minHealth: 25,
        label: "Restore Graywind Heights to 25% health"
      }
    },
    {
      id: "whitebark-cache",
      name: "Whitebark Seed Cache",
      category: "habitat",
      unlockBiome: "alpine",
      output: {
        itemId: "whitebark-cache",
        qty: 1
      },
      materials: {
        "pine-nuts": 4,
        branches: 2
      },
      unlock: {
        minHealth: 30,
        label: "Restore Graywind Heights to 30% health"
      }
    },
    {
      id: "juniper-thicket",
      name: "Juniper Thicket",
      category: "habitat",
      unlockBiome: "alpine",
      output: {
        itemId: "juniper-thicket",
        qty: 1
      },
      materials: {
        "juniper-berries": 3,
        branches: 3,
        moss: 1
      },
      unlock: {
        minHealth: 35,
        label: "Restore Graywind Heights to 35% health"
      }
    },
    {
      id: "cliff-nest-niche",
      name: "Cliff Nest Niche",
      category: "habitat",
      unlockBiome: "alpine",
      output: {
        itemId: "cliff-nest-niche",
        qty: 1
      },
      materials: {
        stones: 4,
        moss: 2,
        lichen: 2
      },
      unlock: {
        minHealth: 45,
        label: "Restore Graywind Heights to 45% health"
      }
    },
    {
      id: "crystal-spring",
      name: "Crystal Snowmelt Spring",
      category: "habitat",
      unlockBiome: "alpine",
      output: {
        itemId: "crystal-spring",
        qty: 1
      },
      materials: {
        "quartz-crystal": 3,
        "clean-water": 4,
        stones: 3
      },
      unlock: {
        minHealth: 60,
        label: "Restore Graywind Heights to 60% health"
      }
    },
    {
      id: "summit-prayer-flags",
      name: "Summit Prayer Flags",
      category: "structure",
      unlockBiome: "alpine",
      output: {
        itemId: "summit-prayer-flags",
        qty: 1
      },
      materials: {
        fiber: 4,
        "alpine-flowers": 2
      },
      unlock: {
        minHealth: 30,
        label: "Restore Graywind Heights to 30% health"
      }
    },
    {
      id: "quartz-lantern",
      name: "Quartz Lantern",
      category: "home",
      unlockBiome: "alpine",
      output: {
        itemId: "quartz-lantern",
        qty: 1
      },
      materials: {
        "quartz-crystal": 2,
        stones: 2,
        fiber: 1
      },
      unlock: {
        minHealth: 40,
        label: "Restore Graywind Heights to 40% health"
      }
    },
    {
      id: "obsidian-totem",
      name: "Obsidian Totem",
      category: "structure",
      unlockBiome: "alpine",
      output: {
        itemId: "obsidian-totem",
        qty: 1
      },
      materials: {
        obsidian: 3,
        stones: 2,
        fiber: 1
      },
      unlock: {
        minHealth: 50,
        label: "Restore Graywind Heights to 50% health"
      }
    },
    {
      id: "large-chest",
      name: "Large Chest",
      category: "storage",
      unlockBiome: "desert",
      output: {
        itemId: "large-chest",
        qty: 1
      },
      materials: {
        branches: 14,
        bark: 6,
        fiber: 6,
        stones: 6,
        clay: 4
      },
      unlock: {
        minHealth: 60,
        requiresCrafted: "medium-chest",
        label: "Restore Redstone Scrubland to 60% health and craft a Medium Chest first"
      }
    },
    {
      id: "home-rug",
      name: "Woven Rug",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "home-rug",
        qty: 1
      },
      materials: {
        fiber: 6
      },
      unlock: {
        minHealth: 10,
        label: "Restore Willow Meadow to 10% health"
      }
    },
    {
      id: "home-table",
      name: "Little Table",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "home-table",
        qty: 1
      },
      materials: {
        branches: 6,
        fiber: 2
      },
      unlock: {
        minHealth: 15,
        label: "Restore Willow Meadow to 15% health"
      }
    },
    {
      id: "home-bed",
      name: "Cozy Bed",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "home-bed",
        qty: 1
      },
      materials: {
        fiber: 8,
        branches: 4
      },
      unlock: {
        minHealth: 20,
        label: "Restore Willow Meadow to 20% health"
      }
    },
    {
      id: "home-bookshelf",
      name: "Bookshelf",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "home-bookshelf",
        qty: 1
      },
      materials: {
        branches: 8,
        fiber: 3
      },
      unlock: {
        minHealth: 30,
        label: "Restore Willow Meadow to 30% health"
      }
    },
    {
      id: "home-armchair",
      name: "Cozy Armchair",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "home-armchair",
        qty: 1
      },
      materials: {
        fiber: 7,
        branches: 3
      },
      unlock: {
        minHealth: 18,
        label: "Restore Willow Meadow to 18% health"
      }
    },
    {
      id: "home-fireplace",
      name: "Stone Fireplace",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "home-fireplace",
        qty: 1
      },
      materials: {
        stones: 8,
        clay: 3
      },
      unlock: {
        minHealth: 25,
        label: "Restore Willow Meadow to 25% health"
      }
    },
    {
      id: "home-lamp",
      name: "Floor Lamp",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "home-lamp",
        qty: 1
      },
      materials: {
        branches: 4,
        fiber: 3
      },
      unlock: {
        minHealth: 12,
        label: "Restore Willow Meadow to 12% health"
      }
    },
    {
      id: "home-potplant",
      name: "House Plant",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "home-potplant",
        qty: 1
      },
      materials: {
        clay: 3,
        wildflowers: 2
      },
      unlock: {
        minHealth: 8,
        label: "Restore Willow Meadow to 8% health"
      }
    },
    {
      id: "home-painting",
      name: "Framed Landscape",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "home-painting",
        qty: 1
      },
      materials: {
        branches: 4,
        fiber: 4
      },
      unlock: {
        minHealth: 22,
        label: "Restore Willow Meadow to 22% health"
      }
    },
    {
      id: "home-sleeping-bag",
      name: "Sleeping Bag",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "home-sleeping-bag",
        qty: 1
      },
      materials: {
        fiber: 4
      },
      unlock: {
        minHealth: 5,
        label: "Restore Willow Meadow to 5% health"
      }
    },
    {
      id: "home-cushions",
      name: "Floor Cushions",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "home-cushions",
        qty: 1
      },
      materials: {
        fiber: 5
      },
      unlock: {
        minHealth: 10,
        label: "Restore that biome to 10% health"
      }
    },
    {
      id: "home-stool",
      name: "Wooden Stool",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "home-stool",
        qty: 1
      },
      materials: {
        branches: 4
      },
      unlock: {
        minHealth: 14,
        label: "Restore that biome to 14% health"
      }
    },
    {
      id: "home-mushroomshelf",
      name: "Mushroom Shelf",
      category: "home",
      unlockBiome: "forest",
      output: {
        itemId: "home-mushroomshelf",
        qty: 1
      },
      materials: {
        mushrooms: 4,
        branches: 4
      },
      unlock: {
        minHealth: 45,
        label: "Restore that biome to 45% health"
      }
    },
    {
      id: "home-reedmat",
      name: "Reed Floor Mat",
      category: "home",
      unlockBiome: "wetland",
      output: {
        itemId: "home-reedmat",
        qty: 1
      },
      materials: {
        reeds: 6
      },
      unlock: {
        minHealth: 30,
        label: "Restore that biome to 30% health"
      }
    },
    {
      id: "home-cactuspot",
      name: "Potted Cactus",
      category: "home",
      unlockBiome: "desert",
      output: {
        itemId: "home-cactuspot",
        qty: 1
      },
      materials: {
        sand: 4,
        clay: 3
      },
      unlock: {
        minHealth: 30,
        label: "Restore that biome to 30% health"
      }
    },
    {
      id: "home-driftwoodshelf",
      name: "Driftwood Shelf",
      category: "home",
      unlockBiome: "coastal",
      output: {
        itemId: "home-driftwoodshelf",
        qty: 1
      },
      materials: {
        driftwood: 5
      },
      unlock: {
        minHealth: 30,
        label: "Restore that biome to 30% health"
      }
    },
    {
      id: "home-wallclock",
      name: "Wall Clock",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "home-wallclock",
        qty: 1
      },
      materials: {
        branches: 5,
        stones: 3
      },
      unlock: {
        minHealth: 40,
        label: "Restore that biome to 40% health"
      }
    },
    {
      id: "home-dresser",
      name: "Wooden Dresser",
      category: "home",
      unlockBiome: "forest",
      output: {
        itemId: "home-dresser",
        qty: 1
      },
      materials: {
        branches: 10,
        bark: 4
      },
      unlock: {
        minHealth: 30,
        label: "Restore that biome to 30% health"
      }
    },
    {
      id: "home-peltrug",
      name: "Woolly Rug",
      category: "home",
      unlockBiome: "alpine",
      output: {
        itemId: "home-peltrug",
        qty: 1
      },
      materials: {
        lichen: 4,
        moss: 4
      },
      unlock: {
        minHealth: 35,
        label: "Restore that biome to 35% health"
      }
    },
    {
      id: "home-chandelier",
      name: "Antler Chandelier",
      category: "home",
      unlockBiome: "forest",
      output: {
        itemId: "home-chandelier",
        qty: 1
      },
      materials: {
        branches: 8,
        bark: 6
      },
      unlock: {
        minHealth: 60,
        label: "Restore that biome to 60% health"
      }
    },
    {
      id: "home-aquarium",
      name: "Aquarium",
      category: "home",
      unlockBiome: "wetland",
      output: {
        itemId: "home-aquarium",
        qty: 1
      },
      materials: {
        "clean-water": 4,
        clay: 6
      },
      unlock: {
        minHealth: 65,
        label: "Restore that biome to 65% health"
      }
    },
    {
      id: "home-telescope",
      name: "Stargazing Telescope",
      category: "home",
      unlockBiome: "alpine",
      output: {
        itemId: "home-telescope",
        qty: 1
      },
      materials: {
        "quartz-crystal": 2,
        branches: 4
      },
      unlock: {
        minHealth: 55,
        label: "Restore that biome to 55% health"
      }
    },
    {
      id: "rain-basin",
      name: "Rain Basin",
      category: "structure",
      unlockBiome: "meadow",
      output: { itemId: "rain-basin", qty: 1 },
      materials: { rainwater: 3, stones: 2 }
    },
    {
      id: "dew-lantern",
      name: "Dewlit Lantern",
      category: "structure",
      unlockBiome: "forest",
      output: { itemId: "dew-lantern", qty: 1 },
      materials: { dewdrops: 3, branches: 2 }
    },
    {
      id: "sunstone-cairn",
      name: "Sunstone Cairn",
      category: "structure",
      unlockBiome: "desert",
      output: { itemId: "sunstone-cairn", qty: 1 },
      materials: { sunstone: 3, stones: 3 }
    },
    {
      id: "frostflower-planter",
      name: "Frostflower Planter",
      category: "structure",
      unlockBiome: "alpine",
      output: { itemId: "frostflower-planter", qty: 1 },
      materials: { frostflower: 3, stones: 2 }
    },
    {
      id: "stormglass-lantern",
      name: "Stormglass Lantern",
      category: "structure",
      unlockBiome: "desert",
      output: { itemId: "stormglass-lantern", qty: 1 },
      materials: { stormglass: 2, stones: 2 }
    },
    {
      id: "frostflower-vase",
      name: "Frostflower Vase",
      category: "home",
      unlockBiome: "alpine",
      output: { itemId: "frostflower-vase", qty: 1 },
      materials: { frostflower: 2, clay: 2 }
    },
    {
      id: "stormglass-chandelier",
      name: "Stormglass Chandelier",
      category: "home",
      unlockBiome: "desert",
      output: { itemId: "stormglass-chandelier", qty: 1 },
      materials: { stormglass: 3, branches: 3 }
    },
    {
      id: "boardwalk",
      name: "Marsh Boardwalk",
      category: "structure",
      unlockBiome: "wetland",
      output: { itemId: "boardwalk", qty: 1 },
      materials: { branches: 6, reeds: 4, clay: 2 }
    },
    {
      id: "heron-rookery",
      name: "Heron Rookery",
      category: "habitat",
      unlockBiome: "wetland",
      output: { itemId: "heron-rookery", qty: 1 },
      materials: { branches: 10, reeds: 5, mud: 3 },
      unlock: { minHealth: 45, label: "Restore Rushwater Wetland to 45% health" }
    },
    {
      id: "dragonfly-pond",
      name: "Dragonfly Pond",
      category: "habitat",
      unlockBiome: "wetland",
      output: { itemId: "dragonfly-pond", qty: 1 },
      materials: { clay: 6, "clean-water": 5, reeds: 4 },
      unlock: { minHealth: 40, label: "Restore Rushwater Wetland to 40% health" }
    }
  ]
};

// data/habitat-objects.json
var habitat_objects_default = {
  database: "wildwillows",
  table: "HabitatObject",
  records: [
    {
      id: "grass-patch",
      name: "Grass Patch",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "alpine"
      ],
      healthValue: 3,
      needs: [
        "plant",
        "open"
      ],
      shape: "patch",
      color: "#7ab35c",
      description: "A soft patch of regrowing grass. A first step for any bare ground.",
      matureHours: 2,
      matureBonus: 1
    },
    {
      id: "native-grass-patch",
      name: "Native Grass Patch",
      placement: "outdoor",
      biomes: [
        "meadow"
      ],
      healthValue: 5,
      needs: [
        "plant",
        "food"
      ],
      shape: "patch",
      color: "#5f9e44",
      description: "Deep-rooted native bunchgrass. Food and cover for meadow life.",
      matureHours: 2,
      matureBonus: 1
    },
    {
      id: "wildflower-patch",
      name: "Wildflower Patch",
      placement: "outdoor",
      biomes: [
        "meadow"
      ],
      healthValue: 5,
      needs: [
        "plant",
        "food"
      ],
      shape: "flowers",
      color: "#d77bb1",
      plantable: true,
      plantCost: {
        seeds: 2
      },
      growSeconds: 45,
      description: "Mixed native wildflowers. Pollinators can spot it from far away.",
      matureHours: 2,
      matureBonus: 1,
      yield: {
        resourceId: "wildflowers",
        qty: 2,
        regrowSeconds: 45
      }
    },
    {
      id: "poppy-patch",
      name: "Poppy Patch",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest"
      ],
      healthValue: 5,
      needs: [
        "plant",
        "food"
      ],
      shape: "poppies",
      color: "#d9534f",
      plantable: true,
      plantCost: {
        seeds: 2,
        wildflowers: 1
      },
      growSeconds: 45,
      description: "Bright field poppies, grown from seed in a watered bed.",
      matureHours: 2,
      matureBonus: 1,
      yield: {
        resourceId: "wildflowers",
        qty: 1,
        regrowSeconds: 45
      }
    },
    {
      id: "sunflower-patch",
      name: "Sunflower Patch",
      placement: "outdoor",
      biomes: [
        "meadow"
      ],
      healthValue: 6,
      needs: [
        "plant",
        "food"
      ],
      shape: "sunflowers",
      color: "#e3c75f",
      plantable: true,
      plantCost: {
        seeds: 3
      },
      growSeconds: 60,
      description: "Tall sunflowers that feed seed-eating birds all season.",
      matureHours: 2,
      matureBonus: 1,
      yield: {
        resourceId: "seeds",
        qty: 2,
        regrowSeconds: 60
      }
    },
    {
      id: "lupine-patch",
      name: "Lupine Patch",
      placement: "outdoor",
      biomes: [
        "meadow",
        "alpine"
      ],
      healthValue: 5,
      needs: [
        "plant",
        "food"
      ],
      shape: "lupines",
      color: "#7d6b9e",
      plantable: true,
      plantCost: {
        seeds: 2,
        fiber: 1
      },
      growSeconds: 50,
      description: "Spires of blue lupine that fix the soil as they bloom.",
      matureHours: 2,
      matureBonus: 1,
      yield: {
        resourceId: "wildflowers",
        qty: 1,
        regrowSeconds: 50
      }
    },
    {
      id: "willow-tree",
      name: "Willow Tree",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "wetland"
      ],
      healthValue: 9,
      needs: [
        "shelter",
        "plant"
      ],
      shape: "willow",
      color: "#6b9152",
      plantable: true,
      plantCost: {
        branches: 2,
        seeds: 2
      },
      growSeconds: 90,
      description: "The preserve's namesake \u2014 a graceful willow grown from a watered bed.",
      matureHours: 8,
      matureBonus: 2
    },
    {
      id: "oak-tree",
      name: "Oak Tree",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest"
      ],
      healthValue: 8,
      needs: [
        "shelter",
        "plant",
        "food"
      ],
      shape: "oak",
      color: "#4a6b3a",
      plantable: true,
      plantCost: {
        acorns: 2
      },
      growSeconds: 90,
      description: "An acorn-grown oak. Squirrels and jays will thank you for decades.",
      matureHours: 8,
      matureBonus: 2,
      yield: {
        resourceId: "acorns",
        qty: 2,
        regrowSeconds: 90
      }
    },
    {
      id: "pine-tree",
      name: "Pine Tree",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "alpine"
      ],
      healthValue: 8,
      needs: [
        "shelter",
        "plant"
      ],
      shape: "pine",
      color: "#3a5a44",
      plantable: true,
      plantCost: {
        pinecones: 2
      },
      growSeconds: 90,
      description: "A young pine grown from a cone \u2014 evergreen shelter in any season.",
      matureHours: 8,
      matureBonus: 2,
      yield: {
        resourceId: "pinecones",
        qty: 2,
        regrowSeconds: 90
      }
    },
    {
      id: "butterfly-flowers",
      name: "Butterfly Flowers",
      placement: "outdoor",
      biomes: [
        "meadow"
      ],
      healthValue: 4,
      needs: [
        "food",
        "plant"
      ],
      shape: "flowers",
      color: "#e8954f",
      description: "Milkweed and nectar flowers, planted especially for butterflies.",
      matureHours: 2,
      matureBonus: 1
    },
    {
      id: "pollinator-garden",
      name: "Pollinator Garden",
      placement: "outdoor",
      biomes: [
        "meadow"
      ],
      healthValue: 6,
      needs: [
        "food",
        "plant"
      ],
      shape: "flowers",
      color: "#c45ad0",
      description: "A dense, season-long banquet for bees and butterflies.",
      matureHours: 2,
      matureBonus: 1
    },
    {
      id: "shrub",
      name: "Shrub",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest"
      ],
      healthValue: 5,
      needs: [
        "shelter",
        "plant"
      ],
      shape: "bush",
      color: "#4f7d3a",
      description: "A young native shrub. Quick cover for anyone passing through.",
      matureHours: 4,
      matureBonus: 1
    },
    {
      id: "berry-bush",
      name: "Berry Bush",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest"
      ],
      healthValue: 6,
      needs: [
        "food",
        "plant"
      ],
      shape: "bush",
      color: "#5d3a5f",
      plantable: true,
      plantCost: {
        seeds: 2,
        berries: 2
      },
      growSeconds: 70,
      description: "A thornless native berry bush. Songbirds, rabbits, deer, and bears all visit. Sow it in a watered bed from seeds and a few berries.",
      matureHours: 4,
      matureBonus: 1,
      yield: {
        resourceId: "berries",
        qty: 2,
        regrowSeconds: 60
      }
    },
    {
      id: "small-pond",
      name: "Small Pond",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest"
      ],
      healthValue: 7,
      needs: [
        "water"
      ],
      shape: "pond",
      color: "#5d96c8",
      description: "A clay-lined pond. Clean drinking water changes everything."
    },
    {
      id: "woodland-pool",
      name: "Woodland Pool",
      placement: "outdoor",
      biomes: [
        "forest"
      ],
      healthValue: 9,
      needs: [
        "water",
        "open"
      ],
      shape: "pond",
      color: "#4f86a8",
      description: "A shaded forest pool fed by a cold spring. Deer, raccoons, and salamanders all come to drink."
    },
    {
      id: "fern-spring",
      name: "Fern Spring",
      placement: "outdoor",
      biomes: [
        "forest"
      ],
      healthValue: 8,
      needs: [
        "water",
        "plant"
      ],
      shape: "pool",
      color: "#6aa884",
      description: "A mossy seep ringed with ferns \u2014 damp ground that wakes the whole understory."
    },
    {
      id: "shallow-water-pool",
      name: "Shallow Water Pool",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "wetland"
      ],
      healthValue: 6,
      needs: [
        "water"
      ],
      shape: "pool",
      color: "#7fb4d8",
      description: "A gently sloped pool, safe for small animals to wade and drink."
    },
    {
      id: "log-shelter",
      name: "Log Shelter",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest"
      ],
      healthValue: 6,
      needs: [
        "shelter"
      ],
      shape: "log",
      color: "#7a5a3a",
      description: "Stacked fallen logs. Small mammals, salamanders, and insects move in fast."
    },
    {
      id: "hollow-log",
      name: "Hollow Log",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest"
      ],
      healthValue: 6,
      needs: [
        "shelter"
      ],
      shape: "log",
      color: "#6a4a30",
      description: "A fallen log carefully opened into a den. Small mammals and foxes love it."
    },
    {
      id: "rock-pile",
      name: "Rock Pile",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "desert",
        "alpine"
      ],
      healthValue: 4,
      needs: [
        "shelter"
      ],
      shape: "rocks",
      color: "#8e8e8a",
      description: "Sun-warmed stones with cool gaps beneath \u2014 insects, lizards, and pika approve."
    },
    {
      id: "fallen-branch-shelter",
      name: "Fallen Branch Shelter",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest"
      ],
      healthValue: 4,
      needs: [
        "shelter"
      ],
      shape: "log",
      color: "#94703f",
      description: "A loose brush pile. Humble, but everyone hides in it."
    },
    {
      id: "bird-perch",
      name: "Bird Perch",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest"
      ],
      healthValue: 3,
      needs: [
        "shelter",
        "open"
      ],
      shape: "perch",
      color: "#9a7448",
      description: "A tall snag for singing and scouting."
    },
    {
      id: "simple-path",
      name: "Stepping-Stone Path",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 1,
      needs: [
        "open"
      ],
      shape: "path",
      color: "#c9b98a",
      description: "Flat stepping stones that keep your boots off the new growth."
    },
    {
      id: "gravel-path",
      name: "Gravel Path",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 1,
      needs: [
        "open"
      ],
      shape: "gravel",
      color: "#a8a8a0",
      description: "Crunchy gravel underfoot \u2014 keeps boots off the new growth."
    },
    {
      id: "plank-path",
      name: "Plank Path",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 1,
      needs: [
        "open"
      ],
      shape: "planks",
      color: "#a3814f",
      description: "Weathered boardwalk planks, kind to soft ground."
    },
    {
      id: "flagstone-path",
      name: "Flagstone Path",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 1,
      needs: [
        "open"
      ],
      shape: "flagstone",
      color: "#9a948a",
      description: "Broad flat stones set into the earth."
    },
    {
      id: "mossy-path",
      name: "Mossy Path",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 1,
      needs: [
        "open"
      ],
      shape: "mossy",
      color: "#7fa05a",
      description: "Old stones wearing soft green moss \u2014 the forest approves."
    },
    {
      id: "wooden-bridge",
      name: "Wooden Bridge",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 1,
      needs: [
        "open"
      ],
      shape: "bridge",
      color: "#a3814f",
      bridge: true,
      description: "A sturdy plank bridge \u2014 place it on open water to cross your rivers and lakes."
    },
    {
      id: "wooden-fence",
      name: "Wooden Fence",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 1,
      needs: [
        "open"
      ],
      shape: "fence",
      color: "#a3814f",
      description: "A low rail fence that marks quiet zones for recovering ground."
    },
    {
      id: "nesting-tree",
      name: "Nesting Tree",
      placement: "outdoor",
      biomes: [
        "forest"
      ],
      healthValue: 8,
      needs: [
        "shelter",
        "plant"
      ],
      shape: "tree",
      color: "#3f6e38",
      description: "A fast-growing native tree planted for squirrels, owls, and nuthatches.",
      matureHours: 8,
      matureBonus: 2
    },
    {
      id: "standing-deadwood",
      name: "Standing Deadwood",
      placement: "outdoor",
      biomes: [
        "forest"
      ],
      healthValue: 5,
      needs: [
        "shelter"
      ],
      shape: "deadwood",
      color: "#8d7a5e",
      description: "A safely anchored dead snag. Woodpecker real estate."
    },
    {
      id: "mushroom-log",
      name: "Mushroom Log",
      placement: "outdoor",
      biomes: [
        "forest"
      ],
      healthValue: 5,
      needs: [
        "food",
        "shelter"
      ],
      shape: "log",
      color: "#7c6248",
      description: "A damp, mossy log seeded with fungi. Salamanders and slugs love the shade."
    },
    {
      id: "reed-bed",
      name: "Reed Bed",
      placement: "outdoor",
      biomes: [
        "wetland"
      ],
      healthValue: 6,
      needs: [
        "plant",
        "shelter",
        "food"
      ],
      shape: "reed",
      color: "#7fa05a",
      description: "Dense replanted reeds \u2014 nursery for frogs, dragonflies, and blackbirds.",
      plantable: true,
      plantCost: {
        reeds: 3
      },
      growSeconds: 45,
      matureHours: 4,
      matureBonus: 1,
      yield: {
        resourceId: "reeds",
        qty: 2,
        regrowSeconds: 45
      }
    },
    {
      id: "mud-bank",
      name: "Mud Bank",
      placement: "outdoor",
      biomes: [
        "wetland"
      ],
      healthValue: 5,
      needs: [
        "shelter"
      ],
      shape: "mound",
      color: "#7a6a52",
      requiresTool: {
        id: "shovel",
        tier: 2
      },
      description: "A shaped soft bank for burrowing and basking. Requires the restoration shovel."
    },
    {
      id: "nesting-platform",
      name: "Nesting Platform",
      placement: "outdoor",
      biomes: [
        "wetland",
        "coastal"
      ],
      healthValue: 6,
      needs: [
        "shelter"
      ],
      shape: "platform",
      color: "#9a8a64",
      description: "A raised, quiet platform safe from floods and footsteps."
    },
    {
      id: "cattail-stand",
      name: "Cattail Stand",
      placement: "outdoor",
      biomes: [
        "wetland"
      ],
      healthValue: 6,
      needs: [
        "plant",
        "shelter"
      ],
      shape: "reed",
      color: "#8aa85a",
      description: "Tall cattails along the water's edge \u2014 cover for nesting marsh birds and shade for the shallows.",
      plantable: true,
      plantCost: {
        reeds: 2
      },
      growSeconds: 45,
      matureHours: 4,
      matureBonus: 1,
      yield: {
        resourceId: "reeds",
        qty: 1,
        regrowSeconds: 45
      }
    },
    {
      id: "marsh-log",
      name: "Marsh Log",
      placement: "outdoor",
      biomes: [
        "wetland"
      ],
      healthValue: 5,
      needs: [
        "shelter"
      ],
      shape: "log",
      color: "#6e553c",
      description: "A half-sunken log for turtles and frogs to bask on and otters to slip beneath."
    },
    {
      id: "lily-pool",
      name: "Lily Pool",
      placement: "outdoor",
      biomes: [
        "wetland"
      ],
      healthValue: 5,
      needs: [
        "plant"
      ],
      shape: "pool",
      color: "#6fae86",
      description: "Still, clean water blanketed with lily pads \u2014 a hatchery for dragonflies and frogs."
    },
    {
      id: "burrow-mound",
      name: "Burrow Mound",
      placement: "outdoor",
      biomes: [
        "desert",
        "alpine"
      ],
      healthValue: 5,
      needs: [
        "shelter"
      ],
      shape: "mound",
      color: "#c2a070",
      requiresTool: {
        id: "shovel",
        tier: 2
      },
      description: "A starter burrow bank for diggers. Requires the restoration shovel."
    },
    {
      id: "cactus-patch",
      name: "Cactus Patch",
      placement: "outdoor",
      biomes: [
        "desert"
      ],
      healthValue: 6,
      needs: [
        "food",
        "plant"
      ],
      shape: "cactus",
      color: "#5e8a4a",
      description: "Transplanted native cactus. Fruit, moisture, and a fortress in one.",
      plantable: true,
      plantCost: {
        "cactus-fruit": 2
      },
      growSeconds: 70,
      matureHours: 4,
      matureBonus: 1,
      yield: {
        resourceId: "cactus-fruit",
        qty: 2,
        regrowSeconds: 70
      }
    },
    {
      id: "desert-brush",
      name: "Desert Brush",
      placement: "outdoor",
      biomes: [
        "desert"
      ],
      healthValue: 5,
      needs: [
        "plant",
        "shelter"
      ],
      shape: "brush",
      color: "#8a8a4e",
      description: "Hardy scrub that throws precious shade.",
      plantable: true,
      plantCost: {
        sand: 2
      },
      growSeconds: 50,
      matureHours: 4,
      matureBonus: 1
    },
    {
      id: "shaded-rock-shelter",
      name: "Shaded Rock Shelter",
      placement: "outdoor",
      biomes: [
        "desert"
      ],
      healthValue: 5,
      needs: [
        "shelter"
      ],
      shape: "shade",
      color: "#a08a72",
      description: "Stacked slabs with a cool dark gap \u2014 shelter from the midday sun."
    },
    {
      id: "alpine-wildflower-patch",
      name: "Alpine Wildflower Patch",
      placement: "outdoor",
      biomes: [
        "alpine"
      ],
      healthValue: 6,
      needs: [
        "food",
        "plant"
      ],
      shape: "flowers",
      color: "#9d86d9",
      description: "Tough little high-country flowers for alpine pollinators.",
      plantable: true,
      plantCost: {
        "alpine-flowers": 2
      },
      growSeconds: 45,
      matureHours: 2,
      matureBonus: 1,
      yield: {
        resourceId: "alpine-flowers",
        qty: 2,
        regrowSeconds: 45
      }
    },
    {
      id: "snowmelt-pool",
      name: "Snowmelt Pool",
      placement: "outdoor",
      biomes: [
        "alpine"
      ],
      healthValue: 6,
      needs: [
        "water"
      ],
      shape: "pool",
      color: "#8fd0e8",
      description: "A stone-lined pool that catches cold, clean snowmelt."
    },
    {
      id: "tidepool",
      name: "Tidepool",
      placement: "outdoor",
      biomes: [
        "coastal"
      ],
      healthValue: 7,
      needs: [
        "water",
        "shelter"
      ],
      shape: "tidepool",
      color: "#5d96c8",
      description: "A restored rocky pool that holds the sea between tides."
    },
    {
      id: "dune-grass",
      name: "Dune Grass",
      placement: "outdoor",
      biomes: [
        "coastal"
      ],
      healthValue: 5,
      needs: [
        "plant",
        "open"
      ],
      shape: "dunegrass",
      color: "#bdb670",
      description: "Deep-rooted grass that anchors the dunes and hides shorebird nests.",
      plantable: true,
      plantCost: {
        sand: 2
      },
      growSeconds: 45,
      matureHours: 4,
      matureBonus: 1
    },
    {
      id: "driftwood-shelter",
      name: "Driftwood Shelter",
      placement: "outdoor",
      biomes: [
        "coastal"
      ],
      healthValue: 5,
      needs: [
        "shelter"
      ],
      shape: "driftwood",
      color: "#b0a088",
      description: "Weathered driftwood stacked into beach shelter."
    },
    {
      id: "kelp-wrack",
      name: "Kelp Wrack",
      placement: "outdoor",
      biomes: [
        "coastal"
      ],
      healthValue: 5,
      needs: [
        "food"
      ],
      shape: "kelp",
      color: "#6a7a3a",
      description: "A protected line of washed-up kelp \u2014 a buffet for the whole beach.",
      matureHours: 4,
      matureBonus: 1
    },
    {
      id: "coastal-nesting-area",
      name: "Coastal Nesting Area",
      placement: "outdoor",
      biomes: [
        "coastal"
      ],
      healthValue: 7,
      needs: [
        "shelter",
        "open"
      ],
      shape: "nest",
      color: "#d8c8a0",
      description: "A roped-off quiet stretch of upper beach for nesting."
    },
    {
      id: "coral-garden",
      name: "Coral Garden",
      placement: "outdoor",
      biomes: [
        "coastal"
      ],
      healthValue: 8,
      needs: [
        "food",
        "shelter"
      ],
      shape: "coralgarden",
      color: "#e58b6f",
      description: "Transplanted coral rubble that grows back into a living reef \u2014 food and shelter for the whole tideline."
    },
    {
      id: "sea-glass-lantern",
      name: "Sea Glass Lantern",
      placement: "outdoor",
      biomes: [
        "coastal"
      ],
      healthValue: 1,
      needs: [],
      shape: "seaglasslantern",
      color: "#8fc6c2",
      description: "Beach-found glass set into a driftwood frame \u2014 it throws soft sea-green light at dusk."
    },
    {
      id: "tide-chime",
      name: "Tide Chime",
      placement: "both",
      biomes: [
        "coastal"
      ],
      healthValue: 0,
      needs: [],
      shape: "tidechime",
      color: "#9bbcc8",
      description: "Shells and sea glass strung on driftwood that ring softly in the onshore breeze."
    },
    {
      id: "pearl-display",
      name: "Pearl Display",
      placement: "outdoor",
      biomes: [
        "coastal"
      ],
      healthValue: 1,
      needs: [],
      shape: "pearldisplay",
      color: "#f2ece0",
      description: "A polished shell cradle showing off the rarest pearls the shore gives up \u2014 the pride of a restored coast."
    },
    {
      id: "sea-glass-path",
      name: "Sea Glass Path",
      placement: "outdoor",
      biomes: [
        "coastal"
      ],
      healthValue: 1,
      needs: [
        "open"
      ],
      shape: "seaglasspath",
      color: "#8fc6c2",
      description: "Tumbled sea glass pressed into the sand \u2014 a glittering walkway that keeps boots off the dunes."
    },
    {
      id: "small-chest",
      name: "Small Chest",
      placement: "both",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 0,
      needs: [],
      shape: "chest",
      color: "#8a6a44",
      isChest: true,
      chestCapacity: 120,
      description: "A woven-and-wood chest. Holds 120 materials. Anything stored here feeds crafting from anywhere."
    },
    {
      id: "medium-chest",
      name: "Medium Chest",
      placement: "both",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 0,
      needs: [],
      shape: "chest",
      color: "#6e553c",
      isChest: true,
      chestCapacity: 250,
      description: "A sturdier chest. Holds 250 materials."
    },
    {
      id: "field-journal-stand",
      name: "Field Journal Stand",
      placement: "both",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 1,
      needs: [],
      shape: "stand",
      color: "#9a7448",
      description: "A little lectern for your field journal \u2014 read it anywhere you place one."
    },
    {
      id: "flower-vase",
      name: "Potted Flowers",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 0,
      needs: [],
      shape: "vase",
      color: "#7a9ac0",
      description: "A clay pot of meadow flowers to brighten your camp."
    },
    {
      id: "wetland-restoration-kit",
      name: "Wetland Restoration Kit",
      placement: "none",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "kit",
      color: "#6fa8d6",
      description: "Liners, filters, and channel tools \u2014 everything needed to re-water the wetland. Crafting it helps unlock Rushwater Wetland."
    },
    {
      id: "migration-path-marker",
      name: "Migration Path Marker",
      placement: "none",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "kit",
      color: "#9d86d9",
      description: "Cairns and markers that restore a safe migration path through the heights. Crafting it helps unlock Pelican Shore."
    },
    {
      id: "forest-restoration-kit",
      name: "Forest Restoration Kit",
      placement: "none",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "kit",
      color: "#8fbf6f",
      description: "Seed mixes, fiber twine, and trail tools to open the overgrown forest path. Crafting it helps unlock Old Hollow Forest."
    },
    {
      id: "scrubland-restoration-kit",
      name: "Scrubland Restoration Kit",
      placement: "none",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "kit",
      color: "#6aa884",
      description: "Sediment sleds and hardy cuttings to carry restoration into the dry scrubland. Crafting it helps unlock Redstone Scrubland."
    },
    {
      id: "alpine-restoration-kit",
      name: "Alpine Restoration Kit",
      placement: "none",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "kit",
      color: "#d6a96a",
      description: "Shade cloth, water caches, and climbing gear for the high country. Crafting it helps unlock Graywind Heights."
    },
    {
      id: "stone-lantern",
      name: "Stone Lantern",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 0,
      needs: [],
      shape: "lantern",
      color: "#caa15a",
      description: "A little stone lantern with a warm glow to light the path."
    },
    {
      id: "wooden-bench",
      name: "Wooden Bench",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 0,
      needs: [],
      shape: "bench",
      color: "#a3814f",
      description: "A weathered bench \u2014 a quiet place to sit and watch the wildlife."
    },
    {
      id: "garden-arch",
      name: "Garden Arch",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "wetland"
      ],
      healthValue: 1,
      needs: [
        "plant"
      ],
      shape: "arch",
      color: "#5e9455",
      description: "A flowering arch that frames a path and feeds passing pollinators."
    },
    {
      id: "bird-bath",
      name: "Bird Bath",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "alpine",
        "desert"
      ],
      healthValue: 2,
      needs: [
        "water"
      ],
      shape: "birdbath",
      color: "#7fb4d8",
      description: "Fresh water for songbirds to drink and bathe."
    },
    {
      id: "trail-signpost",
      name: "Trail Signpost",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 0,
      needs: [],
      shape: "signpost",
      color: "#a3814f",
      description: "A hand-painted signpost to guide visitors through the preserve."
    },
    {
      id: "planter-box",
      name: "Planter Box",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 1,
      needs: [
        "plant"
      ],
      shape: "planter",
      color: "#8c6a42",
      description: "A timber planter box brimming with flowers."
    },
    {
      id: "gazebo",
      name: "Gazebo",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 0,
      needs: [],
      shape: "gazebo",
      color: "#7a9aa8",
      description: "A roofed open-air pavilion \u2014 a charming centerpiece and a shady spot to watch the preserve."
    },
    {
      id: "clover-patch",
      name: "Clover Patch",
      placement: "outdoor",
      biomes: [
        "meadow",
        "alpine"
      ],
      healthValue: 4,
      needs: [
        "plant",
        "food"
      ],
      shape: "clover",
      color: "#6fae5a",
      description: "Low clover and trefoil \u2014 nectar for bees and forage for rabbits.",
      matureHours: 2,
      matureBonus: 1
    },
    {
      id: "brush-pile",
      name: "Brush Pile",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest"
      ],
      healthValue: 4,
      needs: [
        "shelter"
      ],
      shape: "brushpile",
      color: "#8a7048",
      description: "A loose pile of branches \u2014 cover for small mammals and ground birds."
    },
    {
      id: "fern-grove",
      name: "Fern Grove",
      placement: "outdoor",
      biomes: [
        "forest"
      ],
      healthValue: 5,
      needs: [
        "plant",
        "shelter"
      ],
      shape: "fernclump",
      color: "#5e8a4a",
      description: "Shady arching ferns that carpet the forest floor.",
      plantable: true,
      plantCost: {
        moss: 2
      },
      growSeconds: 50,
      matureHours: 4,
      matureBonus: 1
    },
    {
      id: "tree-stump",
      name: "Tree Stump",
      placement: "outdoor",
      biomes: [
        "forest"
      ],
      healthValue: 4,
      needs: [
        "shelter"
      ],
      shape: "stump",
      color: "#8a6a44",
      description: "A mossy old stump riddled with cavities for dens and grubs."
    },
    {
      id: "sedge-tussock",
      name: "Sedge Tussock",
      placement: "outdoor",
      biomes: [
        "wetland"
      ],
      healthValue: 5,
      needs: [
        "plant",
        "shelter"
      ],
      shape: "sedge",
      color: "#8aa85a",
      description: "Clumped sedges along the shallows \u2014 nesting cover for marsh birds.",
      plantable: true,
      plantCost: {
        reeds: 2
      },
      growSeconds: 45,
      matureHours: 4,
      matureBonus: 1
    },
    {
      id: "alder-snag",
      name: "Alder Snag",
      placement: "outdoor",
      biomes: [
        "wetland",
        "forest"
      ],
      healthValue: 5,
      needs: [
        "shelter"
      ],
      shape: "snag",
      color: "#8a7860",
      description: "A standing dead alder \u2014 perch and cavity nest above the water."
    },
    {
      id: "agave-rosette",
      name: "Agave Rosette",
      placement: "outdoor",
      biomes: [
        "desert"
      ],
      healthValue: 4,
      needs: [
        "plant",
        "food"
      ],
      shape: "agave",
      color: "#6f8a5a",
      description: "A spiny rosette whose tall bloom feeds desert pollinators.",
      plantable: true,
      plantCost: {
        "cactus-fruit": 1,
        sand: 1
      },
      growSeconds: 60,
      matureHours: 4,
      matureBonus: 1,
      yield: {
        resourceId: "agave-nectar",
        qty: 1,
        regrowSeconds: 60
      }
    },
    {
      id: "ocotillo",
      name: "Ocotillo",
      placement: "outdoor",
      biomes: [
        "desert"
      ],
      healthValue: 4,
      needs: [
        "plant",
        "shelter"
      ],
      shape: "ocotillo",
      color: "#9a6a4a",
      description: "Whip-like stalks with crimson tips \u2014 cover and nectar in the open flats.",
      plantable: true,
      plantCost: {
        sand: 1,
        branches: 1
      },
      growSeconds: 60,
      matureHours: 4,
      matureBonus: 1
    },
    {
      id: "heather-mat",
      name: "Heather Mat",
      placement: "outdoor",
      biomes: [
        "alpine"
      ],
      healthValue: 4,
      needs: [
        "plant",
        "food"
      ],
      shape: "heather",
      color: "#a06aa8",
      description: "A low alpine mat of heather blossoms above the talus.",
      plantable: true,
      plantCost: {
        "alpine-flowers": 2
      },
      growSeconds: 50,
      matureHours: 4,
      matureBonus: 1,
      yield: {
        resourceId: "alpine-flowers",
        qty: 1,
        regrowSeconds: 50
      }
    },
    {
      id: "krummholz-pine",
      name: "Krummholz Pine",
      placement: "outdoor",
      biomes: [
        "alpine"
      ],
      healthValue: 5,
      needs: [
        "shelter"
      ],
      shape: "krummholz",
      color: "#3f5e3a",
      description: "A wind-sculpted dwarf pine \u2014 rare shelter at the tree line.",
      matureHours: 8,
      matureBonus: 2
    },
    {
      id: "eelgrass-bed",
      name: "Eelgrass Bed",
      placement: "outdoor",
      biomes: [
        "coastal"
      ],
      healthValue: 5,
      needs: [
        "plant",
        "food"
      ],
      shape: "seagrass",
      color: "#6a9a7a",
      description: "Swaying eelgrass \u2014 nursery for fish and grazing for sea geese.",
      plantable: true,
      plantCost: {
        sand: 1,
        driftwood: 1
      },
      growSeconds: 45,
      matureHours: 4,
      matureBonus: 1
    },
    {
      id: "oyster-bed",
      name: "Oyster Bed",
      placement: "outdoor",
      biomes: [
        "coastal"
      ],
      healthValue: 5,
      needs: [
        "food",
        "shelter"
      ],
      shape: "oyster",
      color: "#8e8e8a",
      description: "A clustered shellfish reef that filters the tide and feeds shorebirds."
    },
    {
      id: "daisy-patch",
      name: "Daisy Patch",
      placement: "outdoor",
      biomes: [
        "meadow"
      ],
      healthValue: 4,
      needs: [
        "plant",
        "food"
      ],
      shape: "daisies",
      color: "#e8e8e8",
      plantable: true,
      plantCost: {
        seeds: 2
      },
      growSeconds: 45,
      description: "Cheerful oxeye daisies that open with the morning sun.",
      matureHours: 2,
      matureBonus: 1,
      yield: {
        resourceId: "wildflowers",
        qty: 1,
        regrowSeconds: 45
      }
    },
    {
      id: "foxglove",
      name: "Foxglove",
      placement: "outdoor",
      biomes: [
        "meadow"
      ],
      healthValue: 5,
      needs: [
        "plant",
        "food"
      ],
      shape: "foxglove",
      color: "#c45ad0",
      plantable: true,
      plantCost: {
        seeds: 2,
        wildflowers: 1
      },
      growSeconds: 50,
      description: "Tall pink foxglove spires \u2014 a bumblebee favourite.",
      matureHours: 2,
      matureBonus: 1,
      yield: {
        resourceId: "wildflowers",
        qty: 1,
        regrowSeconds: 50
      }
    },
    {
      id: "mushroom-ring",
      name: "Mushroom Ring",
      placement: "outdoor",
      biomes: [
        "forest"
      ],
      healthValue: 5,
      needs: [
        "plant",
        "food"
      ],
      shape: "mushrooms",
      color: "#c0392b",
      plantable: true,
      plantCost: {
        mushrooms: 2
      },
      growSeconds: 45,
      description: "A fairy ring of woodland mushrooms in the leaf litter.",
      matureHours: 2,
      matureBonus: 1,
      yield: {
        resourceId: "mushrooms",
        qty: 2,
        regrowSeconds: 45
      }
    },
    {
      id: "birch-tree",
      name: "Birch Tree",
      placement: "outdoor",
      biomes: [
        "forest"
      ],
      healthValue: 8,
      needs: [
        "plant",
        "food"
      ],
      shape: "birch",
      color: "#e8e6df",
      plantable: true,
      plantCost: {
        seeds: 2,
        bark: 1
      },
      growSeconds: 90,
      description: "A slender white-barked birch grown from a watered bed.",
      matureHours: 8,
      matureBonus: 2,
      yield: {
        resourceId: "bark",
        qty: 1,
        regrowSeconds: 90
      }
    },
    {
      id: "marsh-marigold",
      name: "Marsh Marigold",
      placement: "outdoor",
      biomes: [
        "wetland"
      ],
      healthValue: 5,
      needs: [
        "plant",
        "food"
      ],
      shape: "marshflower",
      color: "#e3b93f",
      plantable: true,
      plantCost: {
        reeds: 1,
        seeds: 1
      },
      growSeconds: 45,
      description: "Golden marsh marigolds that ring the shallows in spring.",
      matureHours: 2,
      matureBonus: 1,
      yield: {
        resourceId: "wildflowers",
        qty: 1,
        regrowSeconds: 45
      }
    },
    {
      id: "bulrush",
      name: "Bulrush",
      placement: "outdoor",
      biomes: [
        "wetland"
      ],
      healthValue: 5,
      needs: [
        "plant",
        "food"
      ],
      shape: "bulrush",
      color: "#7a5a3a",
      plantable: true,
      plantCost: {
        reeds: 2
      },
      growSeconds: 45,
      description: "Stately bulrushes with brown velvet heads along the bank.",
      matureHours: 4,
      matureBonus: 1,
      yield: {
        resourceId: "reeds",
        qty: 1,
        regrowSeconds: 45
      }
    },
    {
      id: "prickly-pear",
      name: "Prickly Pear",
      placement: "outdoor",
      biomes: [
        "desert"
      ],
      healthValue: 6,
      needs: [
        "plant",
        "food"
      ],
      shape: "pricklypear",
      color: "#5e8a4a",
      plantable: true,
      plantCost: {
        "cactus-fruit": 2
      },
      growSeconds: 70,
      description: "Pad cactus with sweet fruit and bright blooms.",
      matureHours: 4,
      matureBonus: 1,
      yield: {
        resourceId: "cactus-fruit",
        qty: 2,
        regrowSeconds: 70
      }
    },
    {
      id: "desert-marigold",
      name: "Desert Marigold",
      placement: "outdoor",
      biomes: [
        "desert"
      ],
      healthValue: 4,
      needs: [
        "plant",
        "food"
      ],
      shape: "desertbloom",
      color: "#e88a2f",
      plantable: true,
      plantCost: {
        sand: 1,
        seeds: 1
      },
      growSeconds: 50,
      description: "Drought-tough marigolds that glow against the sand.",
      matureHours: 2,
      matureBonus: 1,
      yield: {
        resourceId: "wildflowers",
        qty: 1,
        regrowSeconds: 50
      }
    },
    {
      id: "gentian-patch",
      name: "Alpine Gentian",
      placement: "outdoor",
      biomes: [
        "alpine"
      ],
      healthValue: 5,
      needs: [
        "plant",
        "food"
      ],
      shape: "gentian",
      color: "#3a6ad0",
      plantable: true,
      plantCost: {
        "alpine-flowers": 2
      },
      growSeconds: 45,
      description: "Vivid blue alpine gentians, low against the wind.",
      matureHours: 2,
      matureBonus: 1,
      yield: {
        resourceId: "alpine-flowers",
        qty: 1,
        regrowSeconds: 45
      }
    },
    {
      id: "moss-cushion",
      name: "Moss Cushion",
      placement: "outdoor",
      biomes: [
        "alpine"
      ],
      healthValue: 4,
      needs: [
        "plant",
        "food"
      ],
      shape: "cushion",
      color: "#6fae5a",
      plantable: true,
      plantCost: {
        moss: 2
      },
      growSeconds: 45,
      description: "A springy cushion of moss dotted with tiny blooms.",
      matureHours: 2,
      matureBonus: 1
    },
    {
      id: "sea-thrift",
      name: "Sea Thrift",
      placement: "outdoor",
      biomes: [
        "coastal"
      ],
      healthValue: 5,
      needs: [
        "plant",
        "food"
      ],
      shape: "thrift",
      color: "#e57aa8",
      plantable: true,
      plantCost: {
        sand: 1,
        seeds: 1
      },
      growSeconds: 45,
      description: "Pink sea-thrift pompoms that thrive in salt spray.",
      matureHours: 2,
      matureBonus: 1,
      yield: {
        resourceId: "wildflowers",
        qty: 1,
        regrowSeconds: 45
      }
    },
    {
      id: "beach-shrub",
      name: "Beach Shrub",
      placement: "outdoor",
      biomes: [
        "coastal"
      ],
      healthValue: 5,
      needs: [
        "plant",
        "food"
      ],
      shape: "coastalshrub",
      color: "#7d8f6a",
      plantable: true,
      plantCost: {
        sand: 1,
        driftwood: 1
      },
      growSeconds: 55,
      description: "A salt-hardy grey-green coastal shrub.",
      matureHours: 4,
      matureBonus: 1
    },
    {
      id: "nectar-feeder",
      name: "Nectar Feeder",
      placement: "outdoor",
      biomes: [
        "desert"
      ],
      healthValue: 4,
      needs: [
        "food"
      ],
      shape: "feeder",
      color: "#c0392b",
      description: "A sweet agave-nectar feeder that draws hummingbirds and nectar bats."
    },
    {
      id: "crystal-cairn",
      name: "Crystal Cairn",
      placement: "outdoor",
      biomes: [
        "desert"
      ],
      healthValue: 1,
      needs: [],
      shape: "geoderock",
      color: "#a98fd0",
      description: "A cracked geode set on stacked stones \u2014 a glittering desert landmark."
    },
    {
      id: "sun-totem",
      name: "Sun Totem",
      placement: "outdoor",
      biomes: [
        "desert"
      ],
      healthValue: 0,
      needs: [],
      shape: "totem",
      color: "#c98a5a",
      description: "A carved sandstone totem crowned with a desert crystal."
    },
    {
      id: "palo-verde-tree",
      name: "Palo Verde Tree",
      placement: "outdoor",
      biomes: [
        "desert"
      ],
      healthValue: 8,
      needs: [
        "shelter",
        "plant"
      ],
      shape: "paloverde",
      color: "#9ab86a",
      plantable: true,
      plantCost: {
        seeds: 2,
        sand: 1
      },
      growSeconds: 90,
      description: "The green-barked desert tree \u2014 rare shade and yellow blooms for the scrubland.",
      matureHours: 8,
      matureBonus: 2
    },
    {
      id: "shore-pine",
      name: "Shore Pine",
      placement: "outdoor",
      biomes: [
        "coastal"
      ],
      healthValue: 8,
      needs: [
        "shelter",
        "plant"
      ],
      shape: "shorepine",
      color: "#3f6e4a",
      plantable: true,
      plantCost: {
        seeds: 2,
        sand: 1
      },
      growSeconds: 90,
      description: "A salt-bent pine that anchors the back dunes and shelters shorebirds.",
      matureHours: 8,
      matureBonus: 2
    },
    {
      id: "bald-cypress",
      name: "Bald Cypress",
      placement: "outdoor",
      biomes: [
        "wetland"
      ],
      healthValue: 8,
      needs: [
        "shelter",
        "plant"
      ],
      shape: "cypress",
      color: "#6a8a5a",
      plantable: true,
      plantCost: {
        seeds: 2,
        reeds: 1
      },
      growSeconds: 90,
      description: "A towering swamp cypress with feathery needles and a flared, knee-rooted base.",
      matureHours: 8,
      matureBonus: 2
    },
    {
      id: "water-tupelo",
      name: "Water Tupelo",
      placement: "outdoor",
      biomes: [
        "wetland"
      ],
      healthValue: 8,
      needs: [
        "shelter",
        "plant"
      ],
      shape: "tupelo",
      color: "#5e8a6a",
      plantable: true,
      plantCost: {
        seeds: 2,
        mud: 1
      },
      growSeconds: 90,
      description: "A round-crowned wetland tree whose swollen base stands right in the water.",
      matureHours: 8,
      matureBonus: 2
    },
    {
      id: "mesquite-tree",
      name: "Mesquite",
      placement: "outdoor",
      biomes: [
        "desert"
      ],
      healthValue: 8,
      needs: [
        "shelter",
        "plant"
      ],
      shape: "mesquite",
      color: "#8a9a5a",
      plantable: true,
      plantCost: {
        seeds: 2,
        sand: 1
      },
      growSeconds: 90,
      description: "A low, spreading desert tree \u2014 airy shade and seed pods for the scrubland.",
      matureHours: 8,
      matureBonus: 2
    },
    {
      id: "desert-ironwood",
      name: "Desert Ironwood",
      placement: "outdoor",
      biomes: [
        "desert"
      ],
      healthValue: 8,
      needs: [
        "shelter",
        "plant"
      ],
      shape: "ironwood",
      color: "#7a8a6a",
      plantable: true,
      plantCost: {
        seeds: 2,
        sand: 1
      },
      growSeconds: 90,
      description: "A dense, slow-growing ironwood \u2014 a vital nurse tree in the open desert.",
      matureHours: 8,
      matureBonus: 2
    },
    {
      id: "subalpine-fir",
      name: "Subalpine Fir",
      placement: "outdoor",
      biomes: [
        "alpine"
      ],
      healthValue: 8,
      needs: [
        "shelter",
        "plant"
      ],
      shape: "fir",
      color: "#3f5e48",
      plantable: true,
      plantCost: {
        seeds: 2
      },
      growSeconds: 90,
      description: "A slender spire fir that shrugs off the high-country snow.",
      matureHours: 8,
      matureBonus: 2
    },
    {
      id: "quaking-aspen",
      name: "Quaking Aspen",
      placement: "outdoor",
      biomes: [
        "alpine"
      ],
      healthValue: 8,
      needs: [
        "shelter",
        "plant"
      ],
      shape: "aspen",
      color: "#c9b34a",
      plantable: true,
      plantCost: {
        seeds: 2
      },
      growSeconds: 90,
      description: "White-barked aspen whose golden leaves shiver in the alpine wind.",
      matureHours: 8,
      matureBonus: 2
    },
    {
      id: "monterey-cypress",
      name: "Monterey Cypress",
      placement: "outdoor",
      biomes: [
        "coastal"
      ],
      healthValue: 8,
      needs: [
        "shelter",
        "plant"
      ],
      shape: "mcypress",
      color: "#4f7050",
      plantable: true,
      plantCost: {
        seeds: 2,
        sand: 1
      },
      growSeconds: 90,
      description: "A wind-flattened coastal cypress sculpted by the sea breeze.",
      matureHours: 8,
      matureBonus: 2
    },
    {
      id: "coast-live-oak",
      name: "Coast Live Oak",
      placement: "outdoor",
      biomes: [
        "coastal"
      ],
      healthValue: 8,
      needs: [
        "shelter",
        "plant"
      ],
      shape: "liveoak",
      color: "#4a6b40",
      plantable: true,
      plantCost: {
        seeds: 2
      },
      growSeconds: 90,
      description: "A broad evergreen oak that anchors the back shore with deep shade.",
      matureHours: 8,
      matureBonus: 2
    },
    {
      id: "campfire",
      name: "Campfire",
      placement: "both",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 0,
      needs: [],
      shape: "campfire",
      color: "#d8763a",
      description: "A crackling campfire ringed with stones \u2014 the heart of camp."
    },
    {
      id: "string-lights",
      name: "String Lights",
      placement: "both",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 0,
      needs: [],
      shape: "lanternstring",
      color: "#f0d27a",
      description: "A string of warm little lanterns to hang over your camp."
    },
    {
      id: "pinwheel",
      name: "Pinwheel",
      placement: "both",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 0,
      needs: [],
      shape: "pinwheel",
      color: "#e86a8a",
      description: "A bright pinwheel that spins in the breeze."
    },
    {
      id: "birdhouse",
      name: "Birdhouse",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 0,
      needs: [],
      shape: "birdhouse",
      color: "#9a7448",
      description: "A hand-built birdhouse on a post \u2014 charming, even when empty."
    },
    {
      id: "flower-cart",
      name: "Flower Cart",
      placement: "both",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 0,
      needs: [],
      shape: "flowercart",
      color: "#b5707a",
      description: "A little wooden cart overflowing with cut flowers."
    },
    {
      id: "hammock",
      name: "Hammock",
      placement: "both",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 0,
      needs: [],
      shape: "hammock",
      color: "#c8a86a",
      description: "A woven hammock strung between two posts for lazy afternoons."
    },
    {
      id: "garden-gnome",
      name: "Garden Gnome",
      placement: "both",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 0,
      needs: [],
      shape: "gnome",
      color: "#c0392b",
      description: "A cheerful little gnome to watch over the garden."
    },
    {
      id: "wind-chimes",
      name: "Wind Chimes",
      placement: "both",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 0,
      needs: [],
      shape: "windchime",
      color: "#9bbcc8",
      description: "Driftwood chimes that sing softly when the wind moves through."
    },
    {
      id: "sundial",
      name: "Sundial",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 0,
      needs: [],
      shape: "sundial",
      color: "#a8a8a0",
      description: "A carved stone sundial for telling time the slow way."
    },
    {
      id: "stone-cairn",
      name: "Stone Cairn",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 0,
      needs: [],
      shape: "cairnstack",
      color: "#8e8e8a",
      description: "A balanced stack of smooth stones marking a quiet spot."
    },
    {
      id: "picnic-blanket",
      name: "Picnic Blanket",
      placement: "both",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 0,
      needs: [],
      shape: "picnic",
      color: "#7a9a5a",
      description: "A checked blanket spread out for a sunny picnic."
    },
    {
      id: "flower-pots",
      name: "Flower Pot Row",
      placement: "both",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 0,
      needs: [],
      shape: "potrow",
      color: "#cf7a52",
      description: "A tidy row of terracotta pots brimming with blooms."
    },
    {
      id: "insect-hotel",
      name: "Insect Hotel",
      placement: "outdoor",
      biomes: [
        "meadow"
      ],
      healthValue: 2,
      needs: [],
      shape: "insecthotel",
      color: "#b07a3a",
      description: "A stack of hollow stems and bark that solitary bees and beetles nest in."
    },
    {
      id: "dry-stone-wall",
      name: "Dry Stone Wall",
      placement: "outdoor",
      biomes: [
        "meadow"
      ],
      healthValue: 2,
      needs: [],
      shape: "stonewall",
      color: "#9a948a",
      description: "A low wall of stacked stones with cool, shady gaps for small creatures."
    },
    {
      id: "bat-box",
      name: "Bat Box",
      placement: "outdoor",
      biomes: [
        "forest"
      ],
      healthValue: 2,
      needs: [],
      shape: "batbox",
      color: "#6b5238",
      description: "A tall, narrow roost box where bats shelter through the day."
    },
    {
      id: "leaf-litter-pile",
      name: "Leaf Litter Pile",
      placement: "outdoor",
      biomes: [
        "forest"
      ],
      healthValue: 1,
      needs: [],
      shape: "leaflitter",
      color: "#8a6a3a",
      description: "A mound of damp leaves and moss alive with forest-floor life."
    },
    {
      id: "duck-nest-box",
      name: "Duck Nest Box",
      placement: "outdoor",
      biomes: [
        "wetland"
      ],
      healthValue: 2,
      needs: [],
      shape: "ducknest",
      color: "#7c5a3c",
      description: "A raised wooden box where cavity-nesting waterfowl raise their young."
    },
    {
      id: "basking-log",
      name: "Basking Log",
      placement: "outdoor",
      biomes: [
        "wetland"
      ],
      healthValue: 2,
      needs: [],
      shape: "baskinglog",
      color: "#7a5a3a",
      description: "A half-submerged log where turtles and frogs warm in the sun."
    },
    {
      id: "rock-crevice",
      name: "Rock Crevice",
      placement: "outdoor",
      biomes: [
        "desert"
      ],
      healthValue: 2,
      needs: [],
      shape: "crevice",
      color: "#b07a4a",
      description: "Stacked slabs leaving shady cracks where reptiles shelter from the heat."
    },
    {
      id: "dew-basin",
      name: "Dew Basin",
      placement: "outdoor",
      biomes: [
        "desert"
      ],
      healthValue: 3,
      needs: [],
      shape: "guzzler",
      color: "#9a8a6a",
      description: "A shallow clay basin that catches dew and rain \u2014 precious desert water."
    },
    {
      id: "talus-pile",
      name: "Talus Pile",
      placement: "outdoor",
      biomes: [
        "alpine"
      ],
      healthValue: 2,
      needs: [],
      shape: "talus",
      color: "#9a948a",
      description: "A jumble of broken rock \u2014 the burrows and runways pikas love."
    },
    {
      id: "alpine-nest-shelf",
      name: "Nest Shelf",
      placement: "outdoor",
      biomes: [
        "alpine"
      ],
      healthValue: 2,
      needs: [],
      shape: "nestshelf",
      color: "#8a847a",
      description: "A sheltered rock ledge lined with moss for high-country nesters."
    },
    {
      id: "driftwood-pile",
      name: "Driftwood Pile",
      placement: "outdoor",
      biomes: [
        "coastal"
      ],
      healthValue: 2,
      needs: [],
      shape: "driftpile",
      color: "#b8a888",
      description: "A tangle of sun-bleached driftwood that shelters shore life."
    },
    {
      id: "nesting-bluff",
      name: "Nesting Bluff",
      placement: "outdoor",
      biomes: [
        "coastal"
      ],
      healthValue: 2,
      needs: [],
      shape: "bluff",
      color: "#c2b9a0",
      description: "A built-up sandy bank with ledges for cliff-nesting seabirds."
    },
    {
      id: "pika-haypile",
      name: "Pika Haypile",
      placement: "outdoor",
      biomes: [
        "alpine"
      ],
      healthValue: 4,
      needs: [
        "food",
        "shelter"
      ],
      shape: "haypile",
      color: "#c2b070",
      description: "A stockpile of dried grasses and flowers, cured the way pikas hoard hay for the long winter."
    },
    {
      id: "lichen-boulder",
      name: "Lichen Boulder",
      placement: "outdoor",
      biomes: [
        "alpine"
      ],
      healthValue: 4,
      needs: [
        "food"
      ],
      shape: "lichenrock",
      color: "#9fb38a",
      description: "A weathered boulder crusted with map lichen \u2014 slow alpine grazing and a foothold for new life."
    },
    {
      id: "scree-slope",
      name: "Scree Slope",
      placement: "outdoor",
      biomes: [
        "alpine"
      ],
      healthValue: 3,
      needs: [],
      shape: "scree",
      color: "#9a948a",
      description: "A shifting apron of shattered rock, laced with the runways and hideaways of the high country."
    },
    {
      id: "snowbank-roost",
      name: "Snowbank Roost",
      placement: "outdoor",
      biomes: [
        "alpine"
      ],
      healthValue: 3,
      needs: [
        "water",
        "shelter"
      ],
      shape: "snowbank",
      color: "#eef4fb",
      description: "A packed drift of late-lying snow \u2014 a cool roost and a trickle of meltwater for ptarmigan and hares."
    },
    {
      id: "whitebark-cache",
      name: "Whitebark Seed Cache",
      placement: "outdoor",
      biomes: [
        "alpine"
      ],
      healthValue: 4,
      needs: [
        "food"
      ],
      shape: "seedcache",
      color: "#c8a86a",
      description: "A hidden larder of whitebark pine nuts \u2014 the seed bank nutcrackers and grosbeaks live by."
    },
    {
      id: "juniper-thicket",
      name: "Juniper Thicket",
      placement: "outdoor",
      biomes: [
        "alpine"
      ],
      healthValue: 5,
      needs: [
        "food",
        "shelter"
      ],
      shape: "juniper",
      color: "#5d7a66",
      description: "A low, hardy juniper heavy with frosted berries \u2014 cover and winter food where little else grows.",
      matureHours: 8,
      matureBonus: 2
    },
    {
      id: "cliff-nest-niche",
      name: "Cliff Nest Niche",
      placement: "outdoor",
      biomes: [
        "alpine"
      ],
      healthValue: 4,
      needs: [
        "shelter"
      ],
      shape: "cliffniche",
      color: "#8a847a",
      description: "A sheltered cleft in the cliff face, mossed and tucked away for high-country nesters."
    },
    {
      id: "crystal-spring",
      name: "Crystal Snowmelt Spring",
      placement: "outdoor",
      biomes: [
        "alpine"
      ],
      healthValue: 7,
      needs: [
        "water"
      ],
      shape: "crystalspring",
      color: "#9fdff0",
      description: "An ice-cold spring welling up through quartz \u2014 the purest, coldest water in the heights."
    },
    {
      id: "summit-prayer-flags",
      name: "Summit Prayer Flags",
      placement: "outdoor",
      biomes: [
        "alpine"
      ],
      healthValue: 0,
      needs: [],
      shape: "prayerflags",
      color: "#d77bb1",
      description: "A bright line of weatherworn flags strung between cairns, snapping in the alpine wind."
    },
    {
      id: "quartz-lantern",
      name: "Quartz Lantern",
      placement: "both",
      biomes: [
        "alpine"
      ],
      healthValue: 0,
      needs: [],
      shape: "crystallantern",
      color: "#d8f0fa",
      description: "A stone lantern set with a glowing shard of quartz that holds the last of the daylight."
    },
    {
      id: "obsidian-totem",
      name: "Obsidian Totem",
      placement: "outdoor",
      biomes: [
        "alpine"
      ],
      healthValue: 0,
      needs: [],
      shape: "obsidiantotem",
      color: "#2e2b38",
      description: "A polished column of volcanic glass that catches the high light like dark, still water."
    },
    {
      id: "large-chest",
      name: "Large Chest",
      placement: "both",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "desert",
        "alpine",
        "coastal"
      ],
      healthValue: 0,
      needs: [],
      shape: "largechest",
      color: "#5a4632",
      isChest: true,
      chestCapacity: 500,
      description: "A big iron-banded storage chest. Holds 500 materials \u2014 your main stockpile."
    },
    {
      id: "home-rug",
      name: "Woven Rug",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "rug",
      color: "#b5707a",
      description: "A soft woven rug to warm the floor of your home."
    },
    {
      id: "home-table",
      name: "Little Table",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "table",
      color: "#8a6a48",
      description: "A small wooden table with a sprig of flowers."
    },
    {
      id: "home-bed",
      name: "Cozy Bed",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "bed",
      color: "#7a9ac0",
      description: "A comfortable bed for resting between restoration days.",
      homeMin: 2
    },
    {
      id: "home-bookshelf",
      name: "Bookshelf",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "bookshelf",
      color: "#6e4a33",
      description: "A shelf of field guides and well-thumbed nature books.",
      homeMin: 2
    },
    {
      id: "home-armchair",
      name: "Cozy Armchair",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "armchair",
      color: "#a86f80",
      description: "A plush armchair to sink into after a long day's restoring.",
      homeMin: 2
    },
    {
      id: "home-fireplace",
      name: "Stone Fireplace",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "fireplace",
      color: "#8e8e8a",
      description: "A crackling stone hearth that warms the whole room.",
      homeMin: 2
    },
    {
      id: "home-lamp",
      name: "Floor Lamp",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "lamp",
      color: "#f3d98a",
      description: "A soft floor lamp for cozy evenings indoors."
    },
    {
      id: "home-potplant",
      name: "House Plant",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "potplant",
      color: "#4f7d3a",
      description: "A leafy potted plant to bring a little of the meadow inside."
    },
    {
      id: "home-painting",
      name: "Framed Landscape",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "painting",
      color: "#caa15e",
      description: "A framed painting of the preserve at its finest."
    },
    {
      id: "home-sleeping-bag",
      name: "Sleeping Bag",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "sleepingbag",
      color: "#5b7d9a",
      description: "A simple sleeping bag \u2014 just the thing for a cozy night in the tent."
    },
    {
      id: "home-cushions",
      name: "Floor Cushions",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "cushions",
      color: "#c98a6a",
      description: "A pile of soft floor cushions for lounging."
    },
    {
      id: "home-stool",
      name: "Wooden Stool",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "stool",
      color: "#a86f80",
      description: "A simple cushioned stool."
    },
    {
      id: "home-mushroomshelf",
      name: "Mushroom Shelf",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "mushroomshelf",
      color: "#7a5a3a",
      description: "A little shelf dotted with woodland mushrooms."
    },
    {
      id: "home-reedmat",
      name: "Reed Floor Mat",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "reedmat",
      color: "#b9a06a",
      description: "A woven reed mat from the marsh."
    },
    {
      id: "home-cactuspot",
      name: "Potted Cactus",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "cactuspot",
      color: "#4f8a4a",
      description: "A hardy little cactus in a clay pot."
    },
    {
      id: "home-driftwoodshelf",
      name: "Driftwood Shelf",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "driftwoodshelf",
      color: "#b6a68c",
      description: "A shelf of weathered driftwood with beach finds."
    },
    {
      id: "home-wallclock",
      name: "Wall Clock",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "wallclock",
      color: "#6e4a33",
      description: "A handsome wall clock \u2014 a house needs one.",
      homeMin: 2
    },
    {
      id: "home-dresser",
      name: "Wooden Dresser",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "dresser",
      color: "#8a6a48",
      description: "A sturdy chest of drawers.",
      homeMin: 2
    },
    {
      id: "home-peltrug",
      name: "Woolly Rug",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "peltrug",
      color: "#caa15e",
      description: "A thick, warm rug for cold mountain nights.",
      homeMin: 2
    },
    {
      id: "home-chandelier",
      name: "Antler Chandelier",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "chandelier",
      color: "#caa15e",
      description: "A grand candle chandelier \u2014 fit for a lodge.",
      homeMin: 3
    },
    {
      id: "home-aquarium",
      name: "Aquarium",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "aquarium",
      color: "#7fb4d8",
      description: "A glass tank of darting little fish.",
      homeMin: 3
    },
    {
      id: "home-telescope",
      name: "Stargazing Telescope",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "telescope",
      color: "#5a6b7a",
      description: "A brass telescope for the clear mountain sky.",
      homeMin: 3
    },
    {
      id: "rain-basin",
      name: "Rain Basin",
      placement: "outdoor",
      biomes: [
        "meadow",
        "forest",
        "wetland"
      ],
      healthValue: 5,
      needs: [
        "water"
      ],
      shape: "rainbasin",
      color: "#6fa8d6",
      description: "A carved stone bowl that catches rainwater \u2014 a drinking spot for visiting wildlife."
    },
    {
      id: "dew-lantern",
      name: "Dewlit Lantern",
      placement: "both",
      biomes: [
        "meadow",
        "forest",
        "wetland",
        "alpine",
        "coastal"
      ],
      healthValue: 1,
      needs: [],
      shape: "dewlantern",
      color: "#a8d2c0",
      description: "A glass globe of glowing morning dew that throws a soft green light."
    },
    {
      id: "sunstone-cairn",
      name: "Sunstone Cairn",
      placement: "outdoor",
      biomes: [
        "desert",
        "meadow",
        "forest"
      ],
      healthValue: 4,
      needs: [
        "shelter"
      ],
      shape: "sunstonecairn",
      color: "#e6a94e",
      description: "A stack of sun-baked stones that hold the day's warmth into the cool evening."
    },
    {
      id: "frostflower-planter",
      name: "Frostflower Planter",
      placement: "both",
      biomes: [
        "alpine",
        "forest",
        "meadow"
      ],
      healthValue: 3,
      needs: [
        "plant"
      ],
      shape: "frostflowerplanter",
      color: "#bcd9e8",
      description: "A planter of pale ice-blooms that keep their shape long after the snow has gone."
    },
    {
      id: "stormglass-lantern",
      name: "Stormglass Lantern",
      placement: "both",
      biomes: [
        "desert",
        "coastal",
        "wetland"
      ],
      healthValue: 1,
      needs: [],
      shape: "stormglasslantern",
      color: "#5566a3",
      description: "A shard of lightning-fused glass that flickers with a cold inner light."
    },
    {
      id: "frostflower-vase",
      name: "Frostflower Vase",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "frostflowervase",
      color: "#bcd9e8",
      description: "A glass vase of ice-blooms for the windowsill \u2014 they never wilt.",
      homeMin: 1
    },
    {
      id: "stormglass-chandelier",
      name: "Stormglass Chandelier",
      placement: "indoor",
      biomes: [],
      healthValue: 0,
      needs: [],
      shape: "stormglasschandelier",
      color: "#5566a3",
      description: "A hanging cluster of lightning-glass shards that scatters cool light across the room.",
      homeMin: 2
    },
    {
      id: "boardwalk",
      name: "Marsh Boardwalk",
      placement: "outdoor",
      biomes: [
        "wetland"
      ],
      healthValue: 2,
      needs: [],
      shape: "boardwalk",
      color: "#9a7448",
      description: "A raised plank walkway that lets you cross the marsh without trampling the reeds and mud below."
    },
    {
      id: "heron-rookery",
      name: "Heron Rookery",
      placement: "outdoor",
      biomes: [
        "wetland"
      ],
      healthValue: 6,
      needs: [
        "shelter"
      ],
      shape: "heronrookery",
      color: "#8a8270",
      description: "A tall marsh snag crowned with a stick nest \u2014 exactly the high, safe perch that herons and egrets raise their young on."
    },
    {
      id: "dragonfly-pond",
      name: "Dragonfly Pond",
      placement: "outdoor",
      biomes: [
        "wetland"
      ],
      healthValue: 7,
      needs: [
        "water"
      ],
      shape: "dragonflypond",
      color: "#5aa6cf",
      description: "A clear pool ringed with reeds \u2014 open water where dragonflies hunt and frogs and newts breed."
    }
  ]
};

// data/tools.json
var tools_default = {
  database: "wildwillows",
  table: "ToolDef",
  records: [
    {
      id: "basket",
      name: "Gathering Basket",
      description: "For gently collecting light, renewable materials: seeds, berries, flowers, fiber, shells.",
      tiers: [
        {
          tier: 1,
          name: "Gathering Basket",
          effect: "Carry up to 200 materials and gather 1 at a time."
        },
        {
          tier: 2,
          name: "Reinforced Gathering Basket",
          effect: "Carry up to 350 materials and gather 2 light materials at a time.",
          materials: {
            fiber: 8,
            branches: 4,
            stones: 2
          },
          requires: {
            biome: "meadow",
            minHealth: 40
          }
        },
        {
          tier: 3,
          name: "Woven Carryall",
          effect: "Carry up to 550 materials and gather 3 at a time.",
          materials: {
            fiber: 10,
            bark: 4,
            moss: 4
          },
          requires: {
            biome: "forest",
            minHealth: 60
          }
        },
        {
          tier: 4,
          name: "Naturalist's Pack",
          effect: "Carry up to 800 materials and gather 4 at a time.",
          materials: {
            reeds: 8,
            fiber: 8,
            clay: 4
          },
          requires: {
            biome: "wetland",
            minHealth: 65
          }
        }
      ]
    },
    {
      id: "shovel",
      name: "Basic Shovel",
      description: "For carefully digging stones, clay, and sand, and preparing restoration ground.",
      tiers: [
        {
          tier: 1,
          name: "Basic Shovel",
          effect: "Dig stones, clay, and sand; gather 1 at a time."
        },
        {
          tier: 2,
          name: "Restoration Shovel",
          effect: "Shape wetland mud banks and burrow mounds; gather 2 dug materials.",
          materials: {
            branches: 4,
            stones: 6,
            fiber: 2
          },
          requires: {
            biome: "meadow",
            minHealth: 30
          }
        },
        {
          tier: 3,
          name: "Tempered Spade",
          effect: "Dig faster and gather 3 dug materials at a time.",
          materials: {
            stones: 8,
            bark: 3,
            clay: 4
          },
          requires: {
            biome: "forest",
            minHealth: 55
          }
        },
        {
          tier: 4,
          name: "Earthshaper's Spade",
          effect: "Shape the toughest ground and gather 4 dug materials at a time.",
          materials: {
            stones: 10,
            clay: 6,
            reeds: 4
          },
          requires: {
            biome: "wetland",
            minHealth: 65
          }
        }
      ]
    },
    {
      id: "watering-can",
      name: "Tin Watering Can",
      description: "For carrying water to thirsty ground and new plantings.",
      tiers: [
        {
          tier: 1,
          name: "Tin Watering Can",
          effect: "Collect 1 water from springs and streams."
        },
        {
          tier: 2,
          name: "Rainwater Canteen",
          effect: "Collect 2 water at a time \u2014 restore dry ground more efficiently.",
          materials: {
            clay: 6,
            fiber: 3,
            water: 4
          },
          requires: {
            biome: "meadow",
            minHealth: 30
          }
        },
        {
          tier: 3,
          name: "Spring-fed Ewer",
          effect: "Collect 3 water at a time for rivers, lakes, and lush beds.",
          materials: {
            clay: 8,
            bark: 4,
            water: 6
          },
          requires: {
            biome: "forest",
            minHealth: 55
          }
        },
        {
          tier: 4,
          name: "Cloudcatcher Urn",
          effect: "Collect 4 water at a time \u2014 flood whole channels in a few trips.",
          materials: {
            clay: 10,
            "clean-water": 6,
            stones: 4
          },
          requires: {
            biome: "wetland",
            minHealth: 65
          }
        }
      ]
    },
    {
      id: "field-journal",
      name: "Field Journal",
      description: "For observing animals and recording who has returned. Each area has its own field guide \u2014 gather that area's materials to upgrade and unlock its full entries and return hints.",
      tiers: [
        {
          tier: 1,
          name: "Field Journal",
          effect: "Observe and log who has returned. Upgrade with each area's materials to read its full field entries and return hints."
        },
        {
          tier: 2,
          name: "Willow Meadow Field Guide",
          effect: "Read full entries and return hints for Willow Meadow animals.",
          materials: {
            seeds: 4,
            fiber: 3,
            wildflowers: 2
          },
          requires: {
            biome: "meadow"
          }
        },
        {
          tier: 3,
          name: "Old Hollow Forest Field Guide",
          effect: "Read full entries and return hints for Old Hollow Forest animals.",
          materials: {
            moss: 4,
            mushrooms: 2,
            pinecones: 2
          },
          requires: {
            biome: "forest"
          }
        },
        {
          tier: 4,
          name: "Rushwater Wetland Field Guide",
          effect: "Read full entries and return hints for Rushwater Wetland animals.",
          materials: {
            reeds: 4,
            mud: 2,
            clay: 2
          },
          requires: {
            biome: "wetland"
          }
        },
        {
          tier: 5,
          name: "Redstone Scrubland Field Guide",
          effect: "Read full entries and return hints for Redstone Scrubland animals.",
          materials: {
            "cactus-fruit": 2,
            sand: 3,
            "agave-nectar": 1,
            sunstone: 1
          },
          requires: {
            biome: "desert"
          }
        },
        {
          tier: 6,
          name: "Graywind Heights Field Guide",
          effect: "Read full entries and return hints for Graywind Heights animals.",
          materials: {
            "alpine-flowers": 3,
            lichen: 2,
            "quartz-crystal": 1
          },
          requires: {
            biome: "alpine"
          }
        },
        {
          tier: 7,
          name: "Master Naturalist's Guide",
          effect: "Read full entries and return hints for Pelican Shore animals \u2014 the complete field guide.",
          materials: {
            shells: 3,
            driftwood: 2,
            sand: 2
          },
          requires: {
            biome: "coastal"
          }
        }
      ]
    }
  ]
};

// data/resources.json
var resources_default = {
  database: "wildwillows",
  table: "ResourceType",
  records: [
    {
      id: "seeds",
      name: "Seeds",
      tool: "basket",
      color: "#caa84e"
    },
    {
      id: "berries",
      name: "Berries",
      tool: "basket",
      color: "#a4486c"
    },
    {
      id: "stones",
      name: "Stones",
      tool: "shovel",
      color: "#9a9a98"
    },
    {
      id: "branches",
      name: "Fallen Branches",
      tool: "basket",
      color: "#8a6a44"
    },
    {
      id: "wildflowers",
      name: "Wildflowers",
      tool: "basket",
      color: "#d77bb1"
    },
    {
      id: "reeds",
      name: "Reeds",
      tool: "basket",
      color: "#7fa05a"
    },
    {
      id: "clay",
      name: "Clay",
      tool: "shovel",
      color: "#b07a52"
    },
    {
      id: "water",
      name: "Water",
      tool: "watering-can",
      color: "#6fa8d6"
    },
    {
      id: "fiber",
      name: "Plant Fiber",
      tool: "basket",
      color: "#b8b06a"
    },
    {
      id: "mushrooms",
      name: "Mushrooms",
      tool: "basket",
      color: "#c8997a"
    },
    {
      id: "pinecones",
      name: "Pinecones",
      tool: "basket",
      color: "#7d5b3a"
    },
    {
      id: "acorns",
      name: "Acorns",
      tool: "basket",
      color: "#a07a3e"
    },
    {
      id: "sand",
      name: "Sand",
      tool: "shovel",
      color: "#dcc890"
    },
    {
      id: "shells",
      name: "Shells",
      tool: "basket",
      color: "#e6d8c8"
    },
    {
      id: "driftwood",
      name: "Driftwood",
      tool: "basket",
      color: "#b0a088"
    },
    {
      id: "alpine-flowers",
      name: "Alpine Flowers",
      tool: "basket",
      color: "#9d86d9"
    },
    {
      id: "cactus-fruit",
      name: "Cactus Fruit",
      tool: "basket",
      color: "#d96a5a"
    },
    {
      id: "mud",
      name: "Mud",
      tool: "shovel",
      color: "#7a6a52"
    },
    {
      id: "clean-water",
      name: "Clean Water",
      tool: "watering-can",
      color: "#8fd0e8"
    },
    {
      id: "bark",
      name: "Bark",
      tool: "basket",
      color: "#6e553c"
    },
    {
      id: "moss",
      name: "Moss",
      tool: "basket",
      color: "#5d8a4a"
    },
    {
      id: "geode",
      name: "Geode",
      tool: "shovel",
      color: "#a98fd0"
    },
    {
      id: "agave-nectar",
      name: "Agave Nectar",
      tool: "basket",
      color: "#e3b93f"
    },
    {
      id: "quartz-crystal",
      name: "Quartz Crystal",
      tool: "shovel",
      color: "#cfe8f2"
    },
    {
      id: "pine-nuts",
      name: "Pine Nuts",
      tool: "basket",
      color: "#c8a86a"
    },
    {
      id: "lichen",
      name: "Lichen",
      tool: "basket",
      color: "#9fb38a"
    },
    {
      id: "snow",
      name: "Packed Snow",
      tool: "shovel",
      color: "#eef4fb"
    },
    {
      id: "juniper-berries",
      name: "Juniper Berries",
      tool: "basket",
      color: "#6a7fa0"
    },
    {
      id: "obsidian",
      name: "Obsidian",
      tool: "shovel",
      color: "#2e2b38"
    },
    {
      id: "kelp",
      name: "Kelp",
      tool: "basket",
      color: "#4f7a3f"
    },
    {
      id: "sea-glass",
      name: "Sea Glass",
      tool: "basket",
      color: "#8fc6c2"
    },
    {
      id: "coral",
      name: "Coral",
      tool: "shovel",
      color: "#e58b6f"
    },
    {
      id: "pearl",
      name: "Pearl",
      tool: "basket",
      color: "#f2ece0"
    },
    {
      id: "rainwater",
      name: "Rainwater",
      tool: "basket",
      color: "#6fa8d6"
    },
    {
      id: "stormglass",
      name: "Stormglass",
      tool: "basket",
      color: "#5566a3"
    },
    {
      id: "frostflower",
      name: "Frostflower",
      tool: "basket",
      color: "#bcd9e8"
    },
    {
      id: "dewdrops",
      name: "Morning Dew",
      tool: "basket",
      color: "#a8d2c0"
    },
    {
      id: "sunstone",
      name: "Sunstone",
      tool: "shovel",
      color: "#e6a94e"
    }
  ]
};

// data/animals-1.json
var animals_1_default = {
  database: "wildwillows",
  table: "Animal",
  records: [
    {
      id: "cottontail-rabbit",
      name: "Cottontail Rabbit",
      biome: "meadow",
      kind: "mammal",
      rarity: "common",
      featured: true,
      diet: "Grasses and clover in summer; twigs, bark, and buds in winter",
      shelter: "Rests in shallow grass 'forms'; uses brush piles and old burrows",
      preferredHabitat: "Meadows and field edges with brushy fencerows to bolt into",
      fact: "Cottontails rest in shallow ground depressions called 'forms' rather than digging their own burrows.",
      requirements: {
        minHealth: 25,
        objects: {
          "native-grass-patch": 1,
          "berry-bush": 1,
          shrub: 1
        },
        hint: "Plant native grass and a berry bush, with shrub cover close by."
      },
      scientificName: "Sylvilagus floridanus",
      role: "An abundant grazing herbivore and cornerstone prey animal of the meadow. It feeds on grasses, clover, and woody browse and breeds rapidly to offset heavy predation. Foxes, hawks, owls, and badgers all depend on cottontails as a food source.",
      trophic: "herbivore",
      eatenBy: [
        "american-badger",
        "barn-owl",
        "bobcat",
        "great-horned-owl",
        "red-fox-forest",
        "red-fox-meadow",
        "red-tailed-hawk"
      ],
      eatsOther: [
        "bark",
        "berries",
        "buds",
        "clover",
        "grasses",
        "twigs"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Sylvilagus floridanus",
          url: "https://animaldiversity.org/accounts/Sylvilagus_floridanus/"
        },
        {
          name: "NHPBS NatureWorks \u2014 Eastern Cottontail",
          url: "https://nhpbs.org/natureworks/easterncottontail.htm"
        }
      ]
    },
    {
      id: "monarch-butterfly",
      name: "Monarch Butterfly",
      biome: "meadow",
      kind: "insect",
      rarity: "common",
      featured: true,
      diet: "Caterpillars eat only milkweed; adults sip flower nectar",
      shelter: "Roosts in trees and shrubs; overwinters clustered in dense groves",
      preferredHabitat: "Open meadows and roadsides with milkweed and nectar flowers",
      fact: "Monarchs migrate up to 3,000 miles, but no single butterfly makes the whole round trip; it takes several generations.",
      requirements: {
        minHealth: 15,
        objects: {
          "wildflower-patch": 1,
          "butterfly-flowers": 1
        },
        hint: "Wildflowers plus dedicated butterfly flowers with milkweed."
      },
      scientificName: "Danaus plexippus",
      role: "A milkweed specialist and iconic pollinator whose caterpillars sequester the plant's cardenolide toxins, making both larvae and adults poisonous to most predators. Their bright orange warning coloration keeps nearly all birds and mammals away, so they have very few predators. Adults are important late-season nectar visitors.",
      trophic: "herbivore",
      eatsOther: [
        "flower nectar (adult)",
        "milkweed leaves (caterpillar)"
      ],
      sources: [
        {
          name: "U.S. Fish & Wildlife Service \u2014 Monarch",
          url: "https://www.fws.gov/species/monarch-danaus-plexippus"
        },
        {
          name: "PNAS \u2014 Cardenolide sequestration and toxicity in monarchs",
          url: "https://www.pnas.org/doi/10.1073/pnas.2024463118"
        }
      ]
    },
    {
      id: "song-sparrow",
      name: "Song Sparrow",
      biome: "meadow",
      kind: "bird",
      rarity: "common",
      featured: true,
      diet: "Insects and invertebrates in summer; seeds and fruits year-round",
      shelter: "Cup nest hidden on the ground or low in shrubs and grass tussocks",
      preferredHabitat: "Brushy edges, weedy fields, and marsh edges with singing perches",
      fact: "A male Song Sparrow can learn up to about 20 different tunes and sing hundreds of variations of them.",
      requirements: {
        minHealth: 16,
        objects: {
          shrub: 1,
          "bird-perch": 1
        },
        hint: "Shrubs, native grass, and somewhere high to sing from."
      },
      scientificName: "Melospiza melodia",
      role: "A ground-foraging omnivore that switches between insects in the breeding season and seeds/fruit the rest of the year, so it both controls insects and disperses seeds. Its abundance makes it a key prey item for meadow hawks and snakes, linking ground invertebrates to larger predators.",
      trophic: "omnivore",
      eats: [
        "grasshopper",
        "lady-beetle",
        "praying-mantis"
      ],
      eatenBy: [
        "coopers-hawk",
        "garter-snake-meadow",
        "red-fox-meadow",
        "red-tailed-hawk"
      ],
      eatsOther: [
        "berries",
        "caterpillars",
        "seeds",
        "spiders",
        "wild fruit"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds \u2014 Song Sparrow Life History",
          url: "https://www.allaboutbirds.org/guide/Song_Sparrow/lifehistory"
        },
        {
          name: "Audubon Field Guide \u2014 Song Sparrow",
          url: "https://www.audubon.org/field-guide/bird/song-sparrow"
        }
      ]
    },
    {
      id: "mule-deer",
      name: "Mule Deer",
      biome: "meadow",
      kind: "mammal",
      rarity: "uncommon",
      featured: true,
      diet: "Browses shrubs, forbs, twigs, buds, and seasonal grasses",
      shelter: "Beds in brushy cover, tall grass, or forest edges; no permanent den",
      preferredHabitat: "Open meadows and shrublands with browse and water nearby",
      fact: "Mule deer are named for their oversized, mule-like ears, which rotate independently to pinpoint the direction of danger.",
      requirements: {
        minHealth: 55,
        objects: {
          shrub: 2,
          "native-grass-patch": 2,
          "small-pond": 1
        },
        hint: "A healthier meadow with plenty of browse and a pond to drink from."
      },
      scientificName: "Odocoileus hemionus",
      role: "A large grazing herbivore that shapes meadow vegetation by browsing shrubs and forbs. Its grazing and droppings help cycle nutrients and keep browse in check. Its usual predators (coyotes, mountain lions) are absent from this meadow roster, so it faces little predation here.",
      trophic: "herbivore",
      eatsOther: [
        "buds",
        "forbs",
        "grasses",
        "shrubs",
        "twigs"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Odocoileus hemionus",
          url: "https://animaldiversity.org/accounts/Odocoileus_hemionus/"
        },
        {
          name: "Landmark Wildlife \u2014 Mule Deer ears and senses",
          url: "https://landmarkwildlife.com/stot-this-way-texas-mule-deers-big-ears-bigger-personality/"
        }
      ]
    },
    {
      id: "red-fox-meadow",
      name: "Red Fox",
      biome: "meadow",
      kind: "mammal",
      rarity: "rare",
      featured: true,
      diet: "Voles, rabbits, squirrels, birds, and insects; also berries and carrion",
      shelter: "Digs earthen dens or enlarges burrows; uses brush and hollows",
      preferredHabitat: "Meadows, farmland edges, and hedgerows across open country",
      fact: "When 'mousing,' red foxes tend to pounce facing magnetic northeast, apparently using Earth's magnetic field as a rangefinder to judge the leap.",
      requirements: {
        minHealth: 65,
        minBalance: 40,
        objects: {
          "hollow-log": 1,
          shrub: 2,
          "wildflower-patch": 1
        },
        animals: [
          "meadow-vole",
          "cottontail-rabbit"
        ],
        hint: "Foxes only return once smaller animals are back, with denning cover and a balanced meadow."
      },
      scientificName: "Vulpes vulpes",
      role: "A generalist mesopredator that helps control rodent and rabbit populations, hunting by stalk-and-pounce and rounding out its diet with insects, berries, and carrion. With larger predators like coyotes absent from this roster, it sits near the top of the meadow food web.",
      trophic: "mesopredator",
      eats: [
        "cottontail-rabbit",
        "garter-snake-meadow",
        "grasshopper",
        "ground-squirrel",
        "killdeer",
        "meadow-vole",
        "song-sparrow",
        "western-meadowlark"
      ],
      eatsOther: [
        "berries",
        "bird eggs",
        "carrion",
        "insects"
      ],
      sources: [
        {
          name: "Phys.org \u2014 Predation by foxes aided by Earth's magnetic field",
          url: "https://phys.org/news/2011-01-predation-foxes-aided-earth-magnetic.html"
        },
        {
          name: "Animal Diversity Web \u2014 Vulpes vulpes",
          url: "https://animaldiversity.org/accounts/Vulpes_vulpes/"
        }
      ]
    },
    {
      id: "meadow-vole",
      name: "Meadow Vole",
      biome: "meadow",
      kind: "mammal",
      rarity: "common",
      diet: "Herbivore; grasses, sedges, seeds, roots, and bark in winter",
      shelter: "Shallow burrows and grass nests linked by surface runways",
      preferredHabitat: "Moist grassy meadows and fields with dense ground cover",
      fact: "Voles mow narrow 'runways' through the grass \u2014 tidy little highways they patrol between burrow openings.",
      requirements: {
        minHealth: 10,
        objects: {
          "grass-patch": 1,
          "native-grass-patch": 1
        },
        hint: "Any thick grass cover will do \u2014 voles arrive early."
      },
      scientificName: "Microtus pennsylvanicus",
      role: "A keystone prey species and prolific breeder that converts meadow plants into food for nearly every predator. Its grazing and runway-building shape the grass layer. Its abundance drives the populations of hawks, owls, foxes, snakes, and badgers.",
      trophic: "herbivore",
      eatenBy: [
        "american-badger",
        "barn-owl",
        "barred-owl",
        "bobcat",
        "garter-snake-meadow",
        "great-horned-owl",
        "red-fox-forest",
        "red-fox-meadow",
        "red-tailed-hawk",
        "western-screech-owl"
      ],
      eatsOther: [
        "bark",
        "grasses",
        "roots",
        "sedges",
        "seeds"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Microtus pennsylvanicus",
          url: "https://animaldiversity.org/accounts/Microtus_pennsylvanicus/"
        },
        {
          name: "Chesapeake Bay Program \u2014 Meadow vole",
          url: "https://www.chesapeakebay.net/discover/field-guide/entry/meadow-vole"
        }
      ]
    },
    {
      id: "ground-squirrel",
      name: "Ground Squirrel",
      biome: "meadow",
      kind: "mammal",
      rarity: "common",
      diet: "Mostly seeds, grasses, and flowers, plus insects like grasshoppers",
      shelter: "Extensive multi-entrance burrow systems dug in open ground",
      preferredHabitat: "Open grassy meadows and slopes near rocky lookout points",
      fact: "Facing a rattlesnake, these squirrels kick sand and wave heated tails \u2014 flushing their tails with blood to jam the snake's infrared 'vision.'",
      requirements: {
        minHealth: 14,
        objects: {
          "rock-pile": 1,
          "native-grass-patch": 1
        },
        hint: "Grass to eat and rocks to keep watch from."
      },
      scientificName: "Otospermophilus beecheyi",
      role: "A burrowing omnivore whose diggings aerate soil and whose abandoned burrows shelter other species. It eats seeds, greens, and insects and is major prey for hawks, foxes, snakes, and badgers. Its colonies anchor the meadow's rodent-based food web.",
      trophic: "omnivore",
      eats: [
        "grasshopper"
      ],
      eatenBy: [
        "american-badger",
        "barn-owl",
        "garter-snake-meadow",
        "red-fox-meadow",
        "red-tailed-hawk"
      ],
      eatsOther: [
        "flowers",
        "fruit",
        "grasses",
        "insects",
        "seeds"
      ],
      sources: [
        {
          name: "PNAS \u2014 Ground squirrels heat their tails to discourage rattlesnake attack",
          url: "https://www.pnas.org/doi/10.1073/pnas.0707286104"
        },
        {
          name: "The Ethogram (UC Davis) \u2014 California ground squirrel",
          url: "https://theethogram.com/2020/01/21/creature-feature-california-ground-squirrel/"
        }
      ]
    },
    {
      id: "garter-snake-meadow",
      name: "Garter Snake",
      biome: "meadow",
      kind: "reptile",
      rarity: "uncommon",
      diet: "Earthworms, amphibians, slugs, small fish, insects, and small rodents",
      shelter: "Shelters under rocks and logs; overwinters in communal dens",
      preferredHabitat: "Moist meadows and grasslands near sunny rocks and water",
      fact: "Garter snakes are mildly venomous to their tiny prey but completely harmless to people.",
      requirements: {
        minHealth: 20,
        objects: {
          "rock-pile": 1,
          "grass-patch": 1,
          shrub: 1
        },
        hint: "Warm rocks, grass to hunt in, and small prey already about."
      },
      scientificName: "Thamnophis sirtalis",
      role: "A common meadow mesopredator that hunts earthworms, amphibians, fish, insects, and small rodents, using mild venomous saliva to subdue small prey. It helps control invertebrate and amphibian populations. It is preyed on by hawks, owls, and foxes.",
      trophic: "mesopredator",
      eats: [
        "grasshopper",
        "ground-squirrel",
        "meadow-vole",
        "praying-mantis",
        "song-sparrow"
      ],
      eatenBy: [
        "barn-owl",
        "coopers-hawk",
        "red-fox-meadow",
        "red-tailed-hawk"
      ],
      eatsOther: [
        "amphibians",
        "earthworms",
        "slugs",
        "small fish"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Thamnophis sirtalis",
          url: "https://animaldiversity.org/accounts/Thamnophis_sirtalis/"
        },
        {
          name: "U.S. Fish & Wildlife Service \u2014 Common Garter Snake",
          url: "https://www.fws.gov/species/common-garter-snake-thamnophis-sirtalis"
        }
      ]
    },
    {
      id: "bumblebee",
      name: "Bumblebee",
      biome: "meadow",
      kind: "insect",
      rarity: "common",
      diet: "Nectar for energy and pollen for protein, from many flower types",
      shelter: "Nests in abandoned rodent burrows, grass tussocks, or ground cavities",
      preferredHabitat: "Flower-rich meadows and grasslands with continuous bloom",
      fact: "Bumblebees 'buzz pollinate' \u2014 vibrating their flight muscles to shake pollen loose from flowers like tomatoes and blueberries.",
      requirements: {
        minHealth: 25,
        objects: {
          "wildflower-patch": 1,
          "pollinator-garden": 1,
          shrub: 1
        },
        hint: "The more kinds of flowers, the better."
      },
      scientificName: "Bombus spp.",
      role: "A generalist, large-bodied pollinator that visits a huge variety of flowers for nectar and pollen. Its buzz pollination unlocks pollen that many other bees cannot reach, making it vital to meadow plant reproduction. It is preyed on by ambush hunters and aerial insectivores.",
      trophic: "herbivore",
      eatenBy: [
        "barn-swallow",
        "eastern-bluebird",
        "praying-mantis"
      ],
      eatsOther: [
        "flower nectar",
        "pollen"
      ],
      sources: [
        {
          name: "Xerces Society \u2014 About Bumble Bees",
          url: "https://xerces.org/bumble-bees/about"
        },
        {
          name: "USDA Forest Service \u2014 Bumblebees (Bombus spp.)",
          url: "https://www.fs.usda.gov/wildflowers/pollinators/pollinator-of-the-month/bumblebees.shtml"
        }
      ]
    },
    {
      id: "grasshopper",
      name: "Grasshopper",
      biome: "meadow",
      kind: "insect",
      rarity: "common",
      diet: "Herbivore feeding on grasses, sedges, and broadleaf forbs",
      shelter: "Shelters in grass and low vegetation; lays eggs in soil",
      preferredHabitat: "Sunny grasslands and meadows rich in grasses and forbs",
      fact: "Grasshoppers hear through tympana \u2014 eardrum-like membranes on the first segment of the abdomen, not their heads.",
      requirements: {
        minHealth: 10,
        objects: {
          "grass-patch": 1
        },
        hint: "Grasshoppers return almost as soon as the grass does."
      },
      scientificName: "Melanoplus spp. (family Acrididae)",
      role: "A dominant plant-eater and the meadow's key prey base, converting grasses and forbs into food for a huge range of predators. Its abundance supports birds, snakes, mammals, and other insects. Booms in grasshopper numbers ripple up the whole food web.",
      trophic: "herbivore",
      eatenBy: [
        "eastern-bluebird",
        "garter-snake-meadow",
        "ground-squirrel",
        "killdeer",
        "praying-mantis",
        "red-fox-meadow",
        "song-sparrow",
        "western-meadowlark",
        "western-screech-owl"
      ],
      eatsOther: [
        "grasses",
        "leaves and forbs",
        "sedges"
      ],
      sources: [
        {
          name: "Britannica \u2014 Short-horned grasshopper (Acrididae)",
          url: "https://www.britannica.com/animal/short-horned-grasshopper"
        },
        {
          name: "Ecology and Evolution \u2014 Grasshopper diet (gut-content sequencing)",
          url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4559048/"
        }
      ]
    },
    {
      id: "lady-beetle",
      name: "Lady Beetle",
      biome: "meadow",
      kind: "insect",
      rarity: "common",
      diet: "Predator of aphids and other small, soft-bodied insects",
      shelter: "Overwinters in leaf litter and aggregations; shelters on foliage",
      preferredHabitat: "Meadows and gardens with aphid-infested plants",
      fact: "A single lady beetle can eat around 5,000 aphids over its lifetime \u2014 roughly 50 a day.",
      requirements: {
        minHealth: 12,
        objects: {
          "clover-patch": 1
        },
        hint: "Flowers bring aphids, and aphids bring lady beetles."
      },
      scientificName: "Hippodamia convergens (family Coccinellidae)",
      role: "A voracious small predator that controls aphids and other soft-bodied pests as both larva and adult, making it a valuable biological-control insect. In turn it is eaten by insectivorous birds and larger insect predators, linking the aphid layer up into the food web.",
      trophic: "insectivore",
      eatenBy: [
        "eastern-bluebird",
        "praying-mantis",
        "song-sparrow",
        "western-meadowlark"
      ],
      eatsOther: [
        "aphids",
        "scale insects",
        "small soft-bodied insects",
        "thrips"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Hippodamia convergens",
          url: "https://animaldiversity.org/accounts/Hippodamia_convergens/"
        },
        {
          name: "UC ANR \u2014 Lady beetle aphid consumption",
          url: "https://ucanr.edu/blog/bug-squad/article/incredible-aphid-eating-machines"
        }
      ]
    },
    {
      id: "western-meadowlark",
      name: "Western Meadowlark",
      biome: "meadow",
      kind: "bird",
      rarity: "uncommon",
      diet: "Mostly insects in summer (beetles, grasshoppers); seeds and grain in winter",
      shelter: "Domed grass nest woven on the ground, often with a covered runway",
      preferredHabitat: "Wide native grasslands and meadows with song perches",
      fact: "The Western Meadowlark's flute-like song is the state bird anthem of six U.S. states.",
      requirements: {
        minHealth: 45,
        objects: {
          "native-grass-patch": 2,
          "bird-perch": 1,
          shrub: 1,
          "rain-basin": 1
        },
        hint: "Meadowlarks need real expanses of native grass before they will nest, with a basin to drink and bathe."
      },
      scientificName: "Sturnella neglecta",
      role: "A grassland omnivore that eats large numbers of grasshoppers, crickets, and beetles in summer while taking seeds in winter, helping keep insect populations in check. As a plump ground bird it is important prey for hawks and mammalian predators of the meadow.",
      trophic: "omnivore",
      eats: [
        "grasshopper",
        "lady-beetle",
        "praying-mantis"
      ],
      eatenBy: [
        "american-badger",
        "coopers-hawk",
        "red-fox-meadow",
        "red-tailed-hawk"
      ],
      eatsOther: [
        "ants",
        "beetles",
        "caterpillars",
        "crickets",
        "seeds",
        "waste grain"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds \u2014 Western Meadowlark",
          url: "https://www.allaboutbirds.org/guide/Western_Meadowlark/lifehistory"
        },
        {
          name: "Audubon Field Guide \u2014 Western Meadowlark",
          url: "https://www.audubon.org/field-guide/bird/western-meadowlark"
        }
      ]
    },
    {
      id: "barn-swallow",
      name: "Barn Swallow",
      biome: "meadow",
      kind: "bird",
      rarity: "uncommon",
      diet: "Flying insects caught midair: flies, beetles, bees, wasps, and moths",
      shelter: "Cup nest of mud pellets and grass on beams under eaves and bridges",
      preferredHabitat: "Open country for foraging near water, flowers, and structures",
      fact: "Barn Swallows build their cup nests from up to 1,000 individual beakfuls of mud.",
      requirements: {
        minHealth: 40,
        objects: {
          "small-pond": 1,
          "bird-perch": 1,
          shrub: 1
        },
        hint: "A pond for mud and insects, and a perch to rest between flights."
      },
      scientificName: "Hirundo rustica",
      role: "An aerial insectivore that snaps up huge numbers of flying insects over meadows, following livestock and machinery to catch flushed prey. It is a natural check on flies and flying pests, and both adults and fledglings are hunted by fast-flying hawks.",
      trophic: "insectivore",
      eats: [
        "bumblebee",
        "leafcutter-bee",
        "painted-lady",
        "red-admiral"
      ],
      eatenBy: [
        "coopers-hawk",
        "red-tailed-hawk"
      ],
      eatsOther: [
        "beetles",
        "flies",
        "flying insects",
        "moths",
        "wasps"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds \u2014 Barn Swallow Life History",
          url: "https://www.allaboutbirds.org/guide/Barn_Swallow/lifehistory"
        },
        {
          name: "Audubon Field Guide \u2014 Barn Swallow",
          url: "https://www.audubon.org/field-guide/bird/barn-swallow"
        }
      ]
    },
    {
      id: "red-tailed-hawk",
      name: "Red-tailed Hawk",
      biome: "meadow",
      kind: "bird",
      rarity: "rare",
      diet: "Mostly small mammals (voles, ground squirrels, rabbits); also birds and snakes",
      shelter: "Bulky stick nest in the crown of a tall tree or on a cliff ledge",
      preferredHabitat: "Open country: grasslands, fields, and meadows seen from above",
      fact: "That piercing 'eagle' cry in the movies is almost always actually a Red-tailed Hawk.",
      requirements: {
        minHealth: 70,
        minBalance: 40,
        objects: {
          "bird-perch": 1,
          shrub: 1
        },
        animals: [
          "meadow-vole",
          "ground-squirrel"
        ],
        hint: "Hawks watch for a meadow already full of small animals.",
        conditions: {
          weather: [
            "clear",
            "cloudy"
          ],
          dayPhase: [
            "day"
          ]
        }
      },
      scientificName: "Buteo jamaicensis",
      role: "The meadow's apex daytime hunter, soaring on broad wings or watching from a perch for prey below. By preying on voles, ground squirrels, rabbits, and birds it keeps herbivore numbers in check. Adults have essentially no predators in the meadow.",
      trophic: "apex-predator",
      eats: [
        "barn-swallow",
        "cottontail-rabbit",
        "eastern-bluebird",
        "garter-snake-meadow",
        "ground-squirrel",
        "killdeer",
        "meadow-vole",
        "song-sparrow",
        "western-meadowlark"
      ],
      eatsOther: [
        "carrion",
        "mice"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds \u2014 Red-tailed Hawk Life History",
          url: "https://www.allaboutbirds.org/guide/Red-tailed_Hawk/lifehistory"
        },
        {
          name: "Cornell Lab All About Birds \u2014 Red-tailed Hawk Overview",
          url: "https://www.allaboutbirds.org/guide/Red-tailed_Hawk/overview"
        }
      ]
    },
    {
      id: "barn-owl",
      name: "Barn Owl",
      biome: "meadow",
      kind: "bird",
      rarity: "rare",
      diet: "Almost entirely small mammals \u2014 voles, mice, and shrews; hunted at night",
      shelter: "Nests in tree hollows, cliff crevices, and quiet building cavities",
      preferredHabitat: "Open grasslands and meadows hunted on silent wings at night",
      fact: "A Barn Owl's heart-shaped facial disc funnels sound so precisely it can catch prey in total darkness by ear alone.",
      requirements: {
        minHealth: 75,
        minBalance: 40,
        objects: {
          "log-shelter": 1,
          shrub: 1
        },
        animals: [
          "meadow-vole"
        ],
        hint: "A quiet, healthy meadow with plenty of voles and a dark place to roost.",
        conditions: {
          dayPhase: [
            "dusk",
            "night"
          ]
        }
      },
      scientificName: "Tyto alba",
      role: "The meadow's night-shift rodent hunter, coursing low over the grass on silent wings and swallowing voles and mice whole. This makes it a major check on rodent populations. In the meadow it sits near the top of the food web with no regular predators.",
      trophic: "apex-predator",
      eats: [
        "cottontail-rabbit",
        "garter-snake-meadow",
        "ground-squirrel",
        "meadow-vole"
      ],
      eatsOther: [
        "mice",
        "rats",
        "shrews"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds \u2014 Barn Owl Life History",
          url: "https://www.allaboutbirds.org/guide/American_Barn_Owl/lifehistory"
        },
        {
          name: "Audubon Field Guide \u2014 Barn Owl",
          url: "https://www.audubon.org/field-guide/bird/barn-owl"
        }
      ]
    },
    {
      id: "tree-squirrel",
      name: "Tree Squirrel",
      biome: "forest",
      kind: "mammal",
      rarity: "common",
      featured: true,
      diet: "Acorns, nuts, seeds, tree buds, and fungi; occasional insects and bird eggs",
      shelter: "Tree cavity dens and leaf-and-twig dreys built high in the canopy",
      preferredHabitat: "Mature deciduous or mixed forest rich in oaks and hickories",
      fact: "Gray squirrels scatter-hoard thousands of nuts each year, and the caches they forget grow into new trees.",
      requirements: {
        minHealth: 15,
        objects: {
          "nesting-tree": 1,
          "log-shelter": 1
        },
        hint: "A nesting tree and fallen logs with seeds to cache."
      },
      scientificName: "Sciurus carolinensis",
      role: "Tree squirrels are major seed predators and accidental seed dispersers whose buried, forgotten nuts regenerate the forest canopy. They also spread mycorrhizal fungal spores and occasionally raid bird nests. As abundant prey they feed nearly every forest mesopredator and raptor.",
      trophic: "omnivore",
      eats: [
        "nuthatch",
        "woodpecker"
      ],
      eatenBy: [
        "barred-owl",
        "black-bear",
        "bobcat",
        "fisher",
        "great-horned-owl",
        "red-fox-forest"
      ],
      eatsOther: [
        "acorns",
        "berries",
        "bird eggs",
        "fungi",
        "insects",
        "nuts",
        "seeds",
        "tree buds"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Sciurus carolinensis",
          url: "https://animaldiversity.org/accounts/Sciurus_carolinensis/"
        }
      ]
    },
    {
      id: "woodpecker",
      name: "Woodpecker",
      biome: "forest",
      kind: "bird",
      rarity: "common",
      featured: true,
      diet: "Mostly insects\u2014beetle larvae, ants, caterpillars\u2014with some berries, seeds, and sap",
      shelter: "Self-excavated cavities in standing deadwood; roosts in cavities year-round",
      preferredHabitat: "Open deciduous and mixed woodland with dead snags full of insects",
      fact: "Downy woodpeckers are small enough to hammer into goldenrod galls for fly larvae that larger woodpeckers can't reach.",
      requirements: {
        minHealth: 16,
        objects: {
          "standing-deadwood": 1
        },
        hint: "Woodpeckers need standing deadwood \u2014 keep some snags up."
      },
      scientificName: "Picoides pubescens",
      role: "Woodpeckers regulate wood-boring beetles and bark insects, easing pest pressure on trees. Their abandoned cavities house nuthatches, wrens, and flying squirrels, making them ecosystem engineers. They feed hawks, owls, and nest-raiding squirrels and snakes.",
      trophic: "insectivore",
      eatenBy: [
        "barred-owl",
        "fisher",
        "garter-snake-forest",
        "great-horned-owl",
        "tree-squirrel"
      ],
      eatsOther: [
        "acorns",
        "ants",
        "beetle larvae",
        "berries",
        "caterpillars",
        "sap",
        "spiders"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds \u2014 Downy Woodpecker",
          url: "https://www.allaboutbirds.org/guide/Downy_Woodpecker/lifehistory"
        },
        {
          name: "Animal Diversity Web \u2014 Picoides pubescens",
          url: "https://animaldiversity.org/accounts/Picoides_pubescens/"
        }
      ]
    },
    {
      id: "forest-salamander",
      name: "Forest Salamander",
      biome: "forest",
      kind: "amphibian",
      rarity: "uncommon",
      featured: true,
      diet: "Small invertebrates: mites, springtails, spiders, beetles, ants, and earthworms",
      shelter: "Under logs, rocks, and moist leaf litter; retreats into soil burrows",
      preferredHabitat: "Cool, damp deciduous forest floor with abundant woody debris",
      fact: "In some eastern forests the combined weight of these tiny lungless salamanders exceeds that of all the birds.",
      requirements: {
        minHealth: 40,
        objects: {
          "mushroom-log": 1,
          "shallow-water-pool": 1,
          shrub: 1
        },
        hint: "Damp shaded logs and clean shallow water."
      },
      scientificName: "Plethodon cinereus",
      role: "Red-backed salamanders are a keystone of the forest-floor detritus web, controlling the mites and springtails that break down leaf litter. Their huge collective biomass makes them a key food subsidy for snakes, birds, and small mammals. They breathe through their skin, so they signal forest moisture and soil health.",
      trophic: "insectivore",
      eatenBy: [
        "barred-owl",
        "garter-snake-forest",
        "great-horned-owl",
        "raccoon",
        "red-fox-forest"
      ],
      eatsOther: [
        "ants",
        "beetles",
        "earthworms",
        "mites",
        "snails",
        "spiders",
        "springtails"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Plethodon cinereus",
          url: "https://animaldiversity.org/accounts/Plethodon_cinereus/"
        }
      ]
    },
    {
      id: "great-horned-owl",
      name: "Great Horned Owl",
      biome: "forest",
      kind: "bird",
      rarity: "rare",
      featured: true,
      diet: "Mammals and birds\u2014rabbits, voles, squirrels, chipmunks, skunks\u2014plus reptiles and frogs",
      shelter: "Adopts old hawk, crow, or heron stick nests in large trees; also snags and ledges",
      preferredHabitat: "Mature forest broken by open ground, across nearly every biome",
      fact: "Great horned owls are among the only predators that routinely kill and eat skunks, seemingly unbothered by the spray.",
      requirements: {
        minHealth: 65,
        minBalance: 40,
        objects: {
          "nesting-tree": 2,
          shrub: 1
        },
        animals: [
          "tree-squirrel",
          "chipmunk"
        ],
        hint: "Tall trees, quiet shelter, and prey animals already returned."
      },
      scientificName: "Bubo virginianus",
      role: "The great horned owl sits at the top of the nocturnal forest food web, with the most varied prey base of any North American raptor. It regulates rabbits, squirrels, chipmunks, and even other owls, so its loss lets prey populations surge. Adults have essentially no predators; only eggs and young are vulnerable.",
      trophic: "apex-predator",
      eats: [
        "barred-owl",
        "bobcat",
        "chipmunk",
        "cottontail-rabbit",
        "forest-salamander",
        "garter-snake-forest",
        "little-brown-bat",
        "meadow-vole",
        "northern-flying-squirrel",
        "nuthatch",
        "pacific-wren",
        "pileated-woodpecker",
        "porcupine",
        "raccoon",
        "red-fox-forest",
        "spotted-towhee",
        "tree-squirrel",
        "wood-duck",
        "woodpecker"
      ],
      eatsOther: [
        "carrion",
        "frogs",
        "insects",
        "mice",
        "rabbits",
        "skunks",
        "voles"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds \u2014 Great Horned Owl",
          url: "https://www.allaboutbirds.org/guide/Great_Horned_Owl/lifehistory"
        },
        {
          name: "Animal Diversity Web \u2014 Bubo virginianus",
          url: "https://animaldiversity.org/accounts/Bubo_virginianus/"
        }
      ]
    },
    {
      id: "black-bear",
      name: "Black Bear",
      biome: "forest",
      kind: "mammal",
      rarity: "rare",
      featured: true,
      diet: "Berries, nuts, grasses, and forbs; insects, fish, and carrion; fawns opportunistically",
      shelter: "Dens in hollow trees, root masses, rock crevices, or dug cavities; hibernates in winter",
      preferredHabitat: "Dense forest with thick understory and abundant berry and nut mast",
      fact: "Black bear cubs are born during hibernation weighing under half a pound\u2014the smallest newborns relative to adult size of any placental mammal.",
      requirements: {
        minHealth: 75,
        minBalance: 50,
        objects: {
          "berry-bush": 3,
          "small-pond": 1,
          "log-shelter": 1
        },
        hint: "Bears return only to a richly restored forest: lots of berries, water, shelter, and space.",
        conditions: {
          season: [
            "spring",
            "summer",
            "autumn"
          ]
        }
      },
      scientificName: "Ursus americanus",
      role: "Black bears are generalist omnivores that disperse berry seeds, dig up and regulate colonial insects, and opportunistically take deer fawns and elk calves. As the most abundant large carnivore in North American forests, they link the mast, insect, and vertebrate food layers at once. Adults have essentially no natural predators.",
      trophic: "omnivore",
      eats: [
        "chipmunk",
        "elk-forest",
        "freshwater-fish",
        "garter-snake-forest",
        "mule-deer-forest",
        "porcupine",
        "red-fox-forest",
        "tree-squirrel"
      ],
      eatsOther: [
        "acorns",
        "berries",
        "carrion",
        "grasses",
        "honey",
        "insects",
        "nuts"
      ],
      sources: [
        {
          name: "NPS \u2014 Black Bears",
          url: "https://www.nps.gov/subjects/bears/black-bears.htm"
        },
        {
          name: "Animal Diversity Web \u2014 Ursus americanus",
          url: "https://animaldiversity.org/accounts/Ursus_americanus/"
        }
      ]
    },
    {
      id: "red-fox-forest",
      name: "Red Fox",
      biome: "forest",
      kind: "mammal",
      rarity: "uncommon",
      diet: "Rodents, rabbits, birds, and reptiles; insects, fruit, and carrion",
      shelter: "Earthen dens dug into slopes or taken over from other animals, reused for generations",
      preferredHabitat: "Forest edges and scrub-woodland mixes; avoids dense unbroken forest",
      fact: "Red foxes have around 28 distinct calls, and each individual's voice is recognizable to other foxes.",
      requirements: {
        minHealth: 60,
        objects: {
          "hollow-log": 1,
          shrub: 1,
          "fern-grove": 1
        },
        animals: [
          "chipmunk"
        ],
        hint: "Denning cover and small prey back in the woods."
      },
      scientificName: "Vulpes vulpes",
      role: "The red fox is a versatile mesopredator that keeps small rodents, rabbits, and ground-nesting birds in check while dispersing seeds through the fruit it eats. It sits below apex predators like bears and bobcats and above the small mammals it hunts. Fox pairs often reuse and expand the same den site across generations.",
      trophic: "mesopredator",
      eats: [
        "chipmunk",
        "cottontail-rabbit",
        "fisher",
        "forest-salamander",
        "garter-snake-forest",
        "meadow-vole",
        "northern-flying-squirrel",
        "pileated-woodpecker",
        "raccoon",
        "spotted-towhee",
        "tree-squirrel",
        "wood-duck"
      ],
      eatenBy: [
        "black-bear",
        "bobcat",
        "great-horned-owl"
      ],
      eatsOther: [
        "berries",
        "carrion",
        "earthworms",
        "fruit",
        "insects"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Vulpes vulpes",
          url: "https://animaldiversity.org/accounts/Vulpes_vulpes/"
        },
        {
          name: "National Wildlife Federation \u2014 Raccoon (fox as predator)",
          url: "https://www.nwf.org/Educational-Resources/Wildlife-Guide/Mammals/Raccoon"
        }
      ]
    },
    {
      id: "mule-deer-forest",
      name: "Mule Deer",
      biome: "forest",
      kind: "mammal",
      rarity: "uncommon",
      diet: "Browser: leaves, twigs, and forbs in summer; woody browse, acorns, and berries in winter",
      shelter: "No fixed den; beds in dense shrubs and forest cover for warmth and safety",
      preferredHabitat: "Forest edges and open woodland with shrubby browse and water",
      fact: "A bounding mule deer releases an alarm scent from its hind legs that alerts every nearby deer at once.",
      requirements: {
        minHealth: 55,
        objects: {
          shrub: 2,
          "small-pond": 1,
          "fern-grove": 1
        },
        hint: "Shrubby browse and a quiet pond."
      },
      scientificName: "Odocoileus hemionus",
      role: "Mule deer are key large browsers that shape the forest understory and the regeneration of shrubs and young conifers. They form a critical prey base for large carnivores, while their fawns feed bobcats, foxes, and bears. Seasonal migrations move nutrients across the landscape.",
      trophic: "herbivore",
      eatenBy: [
        "black-bear",
        "bobcat"
      ],
      eatsOther: [
        "acorns",
        "bark",
        "berries",
        "forbs",
        "grasses",
        "leaves",
        "twigs"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Odocoileus hemionus",
          url: "https://animaldiversity.org/accounts/Odocoileus_hemionus/"
        },
        {
          name: "NPS \u2014 Mule Deer",
          url: "https://www.nps.gov/articles/000/mule-deer.htm"
        }
      ]
    },
    {
      id: "elk-forest",
      name: "Elk",
      biome: "forest",
      kind: "mammal",
      rarity: "rare",
      diet: "Grasses, sedges, and forbs in summer; woody browse and bark in winter",
      shelter: "No fixed shelter; calves hidden in dense vegetation; the herd shares vigilance",
      preferredHabitat: "Grassy clearings and open woodland edges within larger forest",
      fact: "In Yellowstone, elk make up about 85% of winter wolf kills and their carcasses feed at least a dozen scavenger species.",
      requirements: {
        minHealth: 70,
        objects: {
          "grass-patch": 2,
          "small-pond": 1,
          shrub: 1
        },
        hint: "Grassy clearings and water in a healthy forest.",
        conditions: {
          season: [
            "autumn",
            "winter"
          ]
        }
      },
      scientificName: "Cervus canadensis",
      role: "Elk are a dominant large herbivore whose heavy grazing shapes grasslands, willows, and aspen; their decline lets vegetation rebound. As the primary prey of wolves, cougars, and bears, they anchor the large-predator food web, and their carcasses sustain a broad scavenger guild. Migrations redistribute nutrients across elevations.",
      trophic: "herbivore",
      eatenBy: [
        "black-bear",
        "bobcat"
      ],
      eatsOther: [
        "acorns",
        "bark",
        "forbs",
        "fungi",
        "grasses",
        "lichens",
        "sedges"
      ],
      sources: [
        {
          name: "NPS Yellowstone \u2014 Elk",
          url: "https://www.nps.gov/yell/learn/nature/elk.htm"
        },
        {
          name: "Animal Diversity Web \u2014 Cervus elaphus",
          url: "https://animaldiversity.org/accounts/Cervus_elaphus/"
        }
      ]
    },
    {
      id: "raccoon",
      name: "Raccoon",
      biome: "forest",
      kind: "mammal",
      rarity: "common",
      diet: "Opportunistic: crayfish, insects, frogs, fish, small mammals, bird eggs, fruit, and nuts",
      shelter: "Hollow tree dens preferred; also rock crevices, burrows, and structures",
      preferredHabitat: "Moist forest near water for foraging and dabbling",
      fact: "A raccoon's sensitive forepaws carry about four times more touch receptors than its eyes have light receptors.",
      requirements: {
        minHealth: 45,
        objects: {
          "hollow-log": 1,
          "small-pond": 1,
          shrub: 1
        },
        hint: "A den log near water to dabble in."
      },
      scientificName: "Procyon lotor",
      role: "Raccoons are adaptable omnivores that regulate crayfish, frogs, and invertebrates while dispersing fruit seeds and preying on bird nests. Their high density makes them a major mid-trophic connector between the aquatic and forest webs. Coyotes, large owls, and bobcats keep them in the mesopredator tier.",
      trophic: "omnivore",
      eats: [
        "banana-slug",
        "barred-owl",
        "chipmunk",
        "ensatina",
        "forest-salamander",
        "freshwater-fish",
        "garter-snake-forest",
        "little-brown-bat",
        "northern-flying-squirrel",
        "pacific-wren",
        "pileated-woodpecker",
        "rough-skinned-newt",
        "spotted-towhee",
        "wood-duck"
      ],
      eatenBy: [
        "bobcat",
        "fisher",
        "great-horned-owl",
        "red-fox-forest"
      ],
      eatsOther: [
        "acorns",
        "berries",
        "bird eggs",
        "carrion",
        "crayfish",
        "insects",
        "nuts"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Procyon lotor",
          url: "https://animaldiversity.org/accounts/Procyon_lotor/"
        },
        {
          name: "National Wildlife Federation \u2014 Raccoon",
          url: "https://www.nwf.org/Educational-Resources/Wildlife-Guide/Mammals/Raccoon"
        }
      ]
    },
    {
      id: "porcupine",
      name: "Porcupine",
      biome: "forest",
      kind: "mammal",
      rarity: "uncommon",
      diet: "Strict herbivore: inner bark in winter; buds, twigs, leaves, and mast in warmer months",
      shelter: "Rock dens, hollow logs, and tree canopies; reuses the same dens seasonally",
      preferredHabitat: "Coniferous and mixed forest with trees offering edible bark",
      fact: "The fisher is one of the only predators able to kill porcupines, flipping them to reach the quill-free belly.",
      requirements: {
        minHealth: 50,
        objects: {
          "nesting-tree": 1,
          "fallen-branch-shelter": 1,
          shrub: 1
        },
        hint: "Trees to climb and brushy shelter below."
      },
      scientificName: "Erethizon dorsatum",
      role: "Porcupines are ecosystem engineers whose bark-stripping kills or deforms trees, creating snags for cavity nesters and diversifying forest structure. Their mast feeding competes with deer and squirrels. They are the main prey base for fishers and a supplemental meal for bobcats and bears.",
      trophic: "herbivore",
      eatenBy: [
        "black-bear",
        "bobcat",
        "fisher",
        "great-horned-owl"
      ],
      eatsOther: [
        "acorns",
        "buds",
        "conifer needles",
        "grasses",
        "inner bark",
        "leaves",
        "twigs"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Erethizon dorsatum",
          url: "https://animaldiversity.org/accounts/Erethizon_dorsatum/"
        },
        {
          name: "NPS Acadia \u2014 Porcupines",
          url: "https://www.nps.gov/articles/acadia-porcupines.htm"
        }
      ]
    },
    {
      id: "bobcat",
      name: "Bobcat",
      biome: "forest",
      kind: "mammal",
      rarity: "rare",
      diet: "Obligate carnivore: rabbits, rodents, squirrels, and deer fawns; some birds and reptiles",
      shelter: "Dens in hollow logs, brush piles, thickets, and rock crevices",
      preferredHabitat: "Forest with dense understory, brushland, and rocky terrain",
      fact: "In the eastern U.S. bobcat numbers rise and fall closely with the local cottontail rabbit supply.",
      requirements: {
        minHealth: 75,
        minBalance: 45,
        objects: {
          "rock-pile": 1,
          shrub: 2,
          "fern-grove": 1
        },
        animals: [
          "tree-squirrel",
          "chipmunk"
        ],
        hint: "Bobcats follow plentiful prey and need rocky, brushy cover.",
        conditions: {
          dayPhase: [
            "dawn",
            "dusk",
            "night"
          ]
        }
      },
      scientificName: "Lynx rufus",
      role: "Bobcats are keystone mesopredators that suppress rabbits, rodents, and squirrels, easing browsing pressure on forest plants. As mid-level hunters they sit below cougars and wolves and above the small mammals they take. They help structure entire small-mammal communities.",
      trophic: "mesopredator",
      eats: [
        "chipmunk",
        "cottontail-rabbit",
        "elk-forest",
        "fisher",
        "meadow-vole",
        "mule-deer-forest",
        "northern-flying-squirrel",
        "pileated-woodpecker",
        "porcupine",
        "raccoon",
        "red-fox-forest",
        "spotted-towhee",
        "tree-squirrel"
      ],
      eatenBy: [
        "fisher",
        "great-horned-owl"
      ],
      eatsOther: [
        "birds",
        "mice",
        "rabbits",
        "reptiles",
        "voles"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Lynx rufus",
          url: "https://animaldiversity.org/accounts/Lynx_rufus/"
        },
        {
          name: "IUCN Red List \u2014 Lynx rufus",
          url: "https://www.iucnredlist.org/species/12521/50655874"
        }
      ]
    },
    {
      id: "chipmunk",
      name: "Chipmunk",
      biome: "forest",
      kind: "mammal",
      rarity: "common",
      diet: "Seeds, nuts, and fruit, plus insects, worms, slugs, fungi, and occasional bird eggs",
      shelter: "Underground burrows up to 10 m long with nest and food-storage chambers",
      preferredHabitat: "Mature deciduous forest with logs, stumps, and rocky cover",
      fact: "Chipmunks don't truly hibernate\u2014they wake through winter to eat from seed caches holding over a liter of food.",
      requirements: {
        minHealth: 12,
        objects: {
          "rock-pile": 1,
          "fallen-branch-shelter": 1
        },
        hint: "Rocky cover and brush piles on the forest floor."
      },
      scientificName: "Tamias striatus",
      role: "Chipmunks are important scatter-hoarders that disperse tree seeds and fungal spores, aiding forest regeneration. They eat many insects in summer and, as abundant prey, feed a wide guild of predators from weasels to owls. Their burrows aerate soil and shelter other small animals.",
      trophic: "omnivore",
      eatenBy: [
        "barred-owl",
        "black-bear",
        "bobcat",
        "fisher",
        "great-horned-owl",
        "raccoon",
        "red-fox-forest"
      ],
      eatsOther: [
        "acorns",
        "berries",
        "bird eggs",
        "earthworms",
        "fungi",
        "insects",
        "nuts",
        "seeds"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Tamias striatus",
          url: "https://animaldiversity.org/accounts/Tamias_striatus/"
        }
      ]
    },
    {
      id: "nuthatch",
      name: "Nuthatch",
      biome: "forest",
      kind: "bird",
      rarity: "common",
      diet: "Insects and spiders in summer; seeds, acorns, and cached nuts through winter",
      shelter: "Tree cavities and old woodpecker holes in mature hardwoods; also nest boxes",
      preferredHabitat: "Mature deciduous and mixed forest with large oaks and hickories",
      fact: "Nuthatches sweep smelly insects around their nest hole, apparently to mask their scent from squirrels.",
      requirements: {
        minHealth: 40,
        objects: {
          "nesting-tree": 1,
          "standing-deadwood": 1,
          shrub: 1
        },
        hint: "Live trees to forage and deadwood to nest in."
      },
      scientificName: "Sitta carolinensis",
      role: "Nuthatches prey on bark-dwelling insects, including tent caterpillars and wood borers, helping check forest pests. By wedging and caching acorns and seeds in bark they aid short-distance seed dispersal. They bridge the insect and seed layers and serve as prey for hawks and owls.",
      trophic: "omnivore",
      eatenBy: [
        "barred-owl",
        "great-horned-owl",
        "pileated-woodpecker",
        "tree-squirrel"
      ],
      eatsOther: [
        "acorns",
        "insect eggs",
        "insects",
        "nuts",
        "seeds",
        "spiders"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds \u2014 White-breasted Nuthatch",
          url: "https://www.allaboutbirds.org/guide/White-breasted_Nuthatch/"
        },
        {
          name: "Animal Diversity Web \u2014 Sitta carolinensis",
          url: "https://animaldiversity.org/accounts/Sitta_carolinensis/"
        }
      ]
    },
    {
      id: "garter-snake-forest",
      name: "Garter Snake",
      biome: "forest",
      kind: "reptile",
      rarity: "uncommon",
      diet: "Earthworms, amphibians, and slugs; also leeches, fish, insects, and small rodents",
      shelter: "Communal winter dens in burrows and rock piles; hides under logs and rocks",
      preferredHabitat: "Moist forest edges and riparian zones near ponds and streams",
      fact: "Garter snakes are the main predator of the toxic rough-skinned newt, and some have evolved resistance to its poison.",
      requirements: {
        minHealth: 45,
        objects: {
          "rock-pile": 1,
          "grass-patch": 1,
          shrub: 1
        },
        hint: "A sunny rock pile beside grassy hunting ground."
      },
      scientificName: "Thamnophis sirtalis",
      role: "Garter snakes are generalist mid-web predators that suppress earthworms, slugs, amphibians, and small fish. In the Pacific Northwest they are the key check on rough-skinned newts, and their toxin resistance makes them a famous coevolutionary node. They are important prey for raptors, corvids, and larger predators.",
      trophic: "mesopredator",
      eats: [
        "banana-slug",
        "ensatina",
        "forest-salamander",
        "little-brown-bat",
        "pacific-wren",
        "rough-skinned-newt",
        "spotted-towhee",
        "wood-duck",
        "woodpecker"
      ],
      eatenBy: [
        "barred-owl",
        "black-bear",
        "fisher",
        "great-horned-owl",
        "raccoon",
        "red-fox-forest"
      ],
      eatsOther: [
        "earthworms",
        "insects",
        "leeches",
        "slugs",
        "small fish"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Thamnophis sirtalis",
          url: "https://animaldiversity.org/accounts/Thamnophis_sirtalis/"
        },
        {
          name: "Animal Diversity Web \u2014 Taricha granulosa",
          url: "https://animaldiversity.org/accounts/Taricha_granulosa/"
        }
      ]
    },
    {
      id: "banana-slug",
      name: "Banana Slug",
      biome: "forest",
      kind: "invertebrate",
      rarity: "common",
      diet: "Dead leaves, fungi, decaying matter, and animal scat; occasional live seedlings",
      shelter: "Under logs and bark; seals into a mucus cocoon during dry spells",
      preferredHabitat: "Cool, shaded, persistently moist Pacific forest floor",
      fact: "Banana slugs pass viable seeds and fungal spores through their gut, seeding plants and mycorrhizal networks as they crawl.",
      requirements: {
        minHealth: 35,
        objects: {
          "mushroom-log": 1,
          "shallow-water-pool": 1,
          shrub: 1
        },
        hint: "Keep the forest floor damp, mossy, and full of logs."
      },
      scientificName: "Ariolimax columbianus",
      role: "Banana slugs are primary decomposers that break down leaf litter and scat, returning nutrients to the soil. They disperse seeds and mycorrhizal spores, partnering with both plants and the fungal networks that feed forest trees. Their numbing mucus deters most predators, leaving garter snakes and shrews as the main consumers.",
      trophic: "decomposer",
      eatenBy: [
        "ensatina",
        "garter-snake-forest",
        "raccoon"
      ],
      eatsOther: [
        "algae",
        "animal scat",
        "carrion",
        "dead leaves",
        "fungi",
        "lichen",
        "seedlings"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Ariolimax columbianus",
          url: "https://animaldiversity.org/accounts/Ariolimax_columbianus/"
        },
        {
          name: "NPS Muir Woods \u2014 Banana Slug",
          url: "https://www.nps.gov/muwo/learn/nature/banana-slug.htm"
        }
      ]
    },
    {
      id: "beaver",
      name: "Beaver",
      biome: "wetland",
      kind: "mammal",
      rarity: "rare",
      featured: true,
      diet: "Bark and cambium of willow and aspen, plus aquatic plants",
      shelter: "Stick-and-mud lodges with underwater entrances",
      preferredHabitat: "Slow channels with mud banks and woody plants to fell",
      fact: "Beaver dams create wetlands that store water and support hundreds of other species.",
      requirements: {
        minHealth: 70,
        objects: {
          "shallow-water-pool": 2,
          "mud-bank": 1,
          "reed-bed": 1
        },
        hint: "Restored water channels, mud banks, and woody plants."
      },
      scientificName: "Castor canadensis",
      role: "The wetland's ecosystem engineer. By felling trees and building dams, beavers flood new ponds, raise the water table, and create habitat that most other marsh species depend on.",
      trophic: "herbivore",
      eatenBy: [
        "river-otter"
      ],
      eatsOther: [
        "aquatic plants",
        "bark",
        "twigs"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Castor canadensis",
          url: "https://animaldiversity.org/accounts/Castor_canadensis/"
        }
      ]
    },
    {
      id: "river-otter",
      name: "River Otter",
      biome: "wetland",
      kind: "mammal",
      rarity: "rare",
      featured: true,
      diet: "Fish, crayfish, frogs, and other aquatic animals",
      shelter: "Bank dens with underwater entrances",
      preferredHabitat: "Clean water rich with fish and slow prey",
      fact: "River otters can hold their breath underwater for up to eight minutes while hunting.",
      requirements: {
        minHealth: 75,
        objects: {
          "shallow-water-pool": 2,
          "mud-bank": 1,
          "reed-bed": 1
        },
        animals: [
          "freshwater-fish"
        ],
        hint: "Otters follow the fish. Restore clean water and den banks first."
      },
      scientificName: "Lontra canadensis",
      role: "An agile aquatic mesopredator that patrols channels for fish and crayfish. Otters keep fish and amphibian numbers in check and are a sign of clean, well-connected water.",
      trophic: "mesopredator",
      eats: [
        "beaver",
        "chorus-frog",
        "freshwater-fish",
        "muskrat",
        "northern-leopard-frog",
        "painted-turtle",
        "spotted-turtle"
      ],
      eatsOther: [
        "crayfish",
        "fish"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Lontra canadensis",
          url: "https://animaldiversity.org/accounts/Lontra_canadensis/"
        }
      ]
    },
    {
      id: "muskrat",
      name: "Muskrat",
      biome: "wetland",
      kind: "mammal",
      rarity: "common",
      diet: "Mainly cattails, reeds, and roots; sometimes clams and small fish",
      shelter: "Dome lodges woven from reeds, and bank burrows",
      preferredHabitat: "Reedy shallows with abundant cattails",
      fact: "Muskrats can stay underwater for up to 15 minutes on a single breath.",
      requirements: {
        minHealth: 40,
        objects: {
          "reed-bed": 1,
          "shallow-water-pool": 1,
          "sedge-tussock": 1
        },
        hint: "Reeds to eat and build with, water to swim."
      },
      scientificName: "Ondatra zibethicus",
      role: "A mostly plant-eating rodent that clips reeds and cattails, opening water lanes used by ducks and other marsh life. It is important prey for mink and otters.",
      trophic: "herbivore",
      eats: [
        "spotted-turtle"
      ],
      eatenBy: [
        "mink",
        "river-otter"
      ],
      eatsOther: [
        "aquatic plants",
        "cattail roots"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Ondatra zibethicus",
          url: "https://animaldiversity.org/accounts/Ondatra_zibethicus/"
        }
      ]
    },
    {
      id: "mink",
      name: "Mink",
      biome: "wetland",
      kind: "mammal",
      rarity: "rare",
      diet: "Fish, frogs, crayfish, and small mammals like muskrats",
      shelter: "Bank burrows, often taken over from muskrats",
      preferredHabitat: "Brushy banks beside busy water",
      fact: "Mink can swim up to 30 metres underwater when chasing prey.",
      requirements: {
        minHealth: 65,
        objects: {
          "mud-bank": 1,
          "reed-bed": 1,
          "sedge-tussock": 1
        },
        animals: [
          "chorus-frog"
        ],
        hint: "Bank shelter and plenty of small wetland prey."
      },
      scientificName: "Neogale vison",
      role: "A fierce semi-aquatic hunter that takes fish, frogs, and even muskrats. Mink are versatile mesopredators that help regulate small wetland prey.",
      trophic: "mesopredator",
      eats: [
        "chorus-frog",
        "freshwater-fish",
        "hooded-merganser",
        "mallard-duck",
        "muskrat",
        "northern-leopard-frog",
        "painted-turtle",
        "red-winged-blackbird"
      ],
      eatsOther: [
        "crayfish",
        "fish"
      ],
      sources: [
        {
          name: "Animal Diversity Web - American mink",
          url: "https://animaldiversity.org/accounts/Neovison_vison/"
        },
        {
          name: "NatureServe Explorer - Neogale vison",
          url: "https://explorer.natureserve.org/Taxon/ELEMENT_GLOBAL.2.791856/Neogale_vison"
        }
      ]
    },
    {
      id: "great-blue-heron",
      name: "Great Blue Heron",
      biome: "wetland",
      kind: "bird",
      rarity: "uncommon",
      featured: true,
      diet: "Fish, frogs, and small aquatic animals; also voles and other birds",
      shelter: "Colonial stick nests high in trees near water",
      preferredHabitat: "Still shallows for slow, patient hunting",
      fact: "A great blue heron can strike like lightning to spear a fish or snap up a vole.",
      requirements: {
        minHealth: 60,
        objects: {
          "shallow-water-pool": 2,
          "reed-bed": 1,
          "nesting-platform": 1
        },
        animals: [
          "freshwater-fish"
        ],
        hint: "Shallow water with fish, reeds, and quiet nesting space."
      },
      scientificName: "Ardea herodias",
      role: "The tall, patient sentinel of the shallows and a top predator of the wetland's fish community. It stalks slowly, then strikes faster than the eye can follow.",
      trophic: "apex-predator",
      eats: [
        "chorus-frog",
        "dragonfly",
        "freshwater-fish",
        "northern-leopard-frog"
      ],
      eatsOther: [
        "fish"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds - Great Blue Heron",
          url: "https://www.allaboutbirds.org/guide/Great_Blue_Heron/lifehistory"
        }
      ]
    },
    {
      id: "mallard-duck",
      name: "Mallard Duck",
      biome: "wetland",
      kind: "bird",
      rarity: "common",
      diet: "Seeds and aquatic plants, plus insect larvae, snails, and worms",
      shelter: "Ground nests hidden in reedy water edges",
      preferredHabitat: "Calm pools with reed cover",
      fact: "Mallards can sleep with one eye open, resting half their brain at a time.",
      requirements: {
        minHealth: 25,
        objects: {
          "shallow-water-pool": 1,
          "reed-bed": 1
        },
        hint: "Calm shallow water with reed cover."
      },
      scientificName: "Anas platyrhynchos",
      role: "A dabbling omnivore that tips forward to feed on seeds, plants, and small invertebrates. Its ducklings and eggs feed many marsh predators.",
      trophic: "omnivore",
      eatenBy: [
        "mink",
        "snapping-turtle"
      ],
      eatsOther: [
        "aquatic plants",
        "insect larvae",
        "seeds"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds - Mallard",
          url: "https://www.allaboutbirds.org/guide/Mallard/lifehistory"
        }
      ]
    },
    {
      id: "red-winged-blackbird",
      name: "Red-winged Blackbird",
      biome: "wetland",
      kind: "bird",
      rarity: "common",
      diet: "Insects in summer, seeds and grain the rest of the year",
      shelter: "Cup nests woven into standing reeds",
      preferredHabitat: "Dense reed beds and cattail marsh",
      fact: "Male red-winged blackbirds can hide or flash their scarlet shoulder patches at will.",
      requirements: {
        minHealth: 25,
        objects: {
          "reed-bed": 2
        },
        hint: "The thicker the reeds, the better."
      },
      scientificName: "Agelaius phoeniceus",
      role: "An abundant, noisy marsh songbird that eats insects and seeds. Males fiercely defend reed-bed territories that may hold a dozen nests.",
      trophic: "omnivore",
      eatenBy: [
        "mink"
      ],
      eatsOther: [
        "insects",
        "seeds"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds - Red-winged Blackbird",
          url: "https://www.allaboutbirds.org/guide/Red-winged_Blackbird/lifehistory"
        }
      ]
    },
    {
      id: "sandhill-crane",
      name: "Sandhill Crane",
      biome: "wetland",
      kind: "bird",
      rarity: "rare",
      diet: "Grains, tubers, insects, and small animals",
      shelter: "Large ground mounds of marsh plants near standing water",
      preferredHabitat: "Broad, quiet, restored marshland",
      fact: "Sandhill cranes mate for life and choose partners through leaping, bowing dances.",
      requirements: {
        minHealth: 75,
        minBalance: 45,
        objects: {
          "shallow-water-pool": 2,
          "reed-bed": 2,
          "sedge-tussock": 1
        },
        hint: "Cranes need a wide, quiet, well-balanced marsh.",
        conditions: {
          season: [
            "spring",
            "autumn"
          ]
        }
      },
      scientificName: "Antigone canadensis",
      role: "A stately omnivore of open marsh that probes for tubers and grain and snaps up insects and small animals. Its presence signals a wide, healthy wetland.",
      trophic: "omnivore",
      eats: [
        "chorus-frog"
      ],
      eatsOther: [
        "grain",
        "insects",
        "tubers"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds - Sandhill Crane",
          url: "https://www.allaboutbirds.org/guide/Sandhill_Crane/lifehistory"
        }
      ]
    },
    {
      id: "painted-turtle",
      name: "Painted Turtle",
      biome: "wetland",
      kind: "reptile",
      rarity: "common",
      diet: "Aquatic plants, insects, small fish, and carrion",
      shelter: "Muddy pond bottoms; basks on logs",
      preferredHabitat: "Still water with basking logs",
      fact: "Painted turtles overwinter under the ice, taking in oxygen through their skin.",
      requirements: {
        minHealth: 45,
        objects: {
          "shallow-water-pool": 1,
          "mud-bank": 1,
          "reed-bed": 1
        },
        hint: "Still water and a soft bank to bask on."
      },
      scientificName: "Chrysemys picta",
      role: "A basking omnivore that grazes plants and hunts insects and small fish, and cleans up carrion. Young are mostly carnivorous, shifting toward plants with age.",
      trophic: "omnivore",
      eats: [
        "freshwater-fish"
      ],
      eatenBy: [
        "mink",
        "river-otter"
      ],
      eatsOther: [
        "aquatic plants",
        "detritus",
        "insects"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Chrysemys picta",
          url: "https://animaldiversity.org/accounts/Chrysemys_picta/"
        },
        {
          name: "Turtle Guardians - Overwintering Herpetofauna",
          url: "https://www.turtleguardians.com/2024/05/butt-breathers-and-frogsicles-overwintering-herpetofauna-at-their-northern-range-limit/"
        }
      ]
    },
    {
      id: "chorus-frog",
      name: "Chorus Frog",
      biome: "wetland",
      kind: "amphibian",
      rarity: "common",
      featured: true,
      diet: "Small insects and other tiny invertebrates",
      shelter: "Shallow water and wet vegetation",
      preferredHabitat: "Shallow pools ringed with reeds",
      fact: "A chorus frog's comb-like call carries up to half a mile across the marsh.",
      requirements: {
        minHealth: 30,
        objects: {
          "shallow-water-pool": 1,
          "reed-bed": 1
        },
        hint: "Shallow water, reeds, and insect life."
      },
      scientificName: "Pseudacris triseriata",
      role: "A tiny insectivore whose spring chorus fills the marsh. It eats small invertebrates and is itself vital prey for herons, mink, and snakes.",
      trophic: "insectivore",
      eats: [
        "damselfly",
        "dragonfly",
        "water-strider"
      ],
      eatenBy: [
        "american-bittern",
        "great-blue-heron",
        "mink",
        "river-otter",
        "sandhill-crane"
      ],
      eatsOther: [
        "insect larvae",
        "insects"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Pseudacris triseriata",
          url: "https://animaldiversity.org/accounts/Pseudacris_triseriata/"
        }
      ]
    },
    {
      id: "wetland-salamander",
      name: "Tiger Salamander",
      biome: "wetland",
      kind: "amphibian",
      rarity: "uncommon",
      diet: "Worms, insects, small invertebrates, and even small vertebrates",
      shelter: "Damp burrows near fishless breeding pools",
      preferredHabitat: "Fishless pools with soft banks",
      fact: "Tiger salamanders are among the largest land salamanders in North America.",
      requirements: {
        minHealth: 50,
        objects: {
          "shallow-water-pool": 1,
          "mud-bank": 1,
          "reed-bed": 1
        },
        hint: "Quiet breeding pools with soft digging banks."
      },
      scientificName: "Ambystoma tigrinum",
      role: "A voracious burrowing carnivore that hunts worms and invertebrates near breeding pools. Larvae grow in fishless water and can even turn cannibal.",
      trophic: "insectivore",
      eatsOther: [
        "insect larvae",
        "insects",
        "worms"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Ambystoma tigrinum",
          url: "https://animaldiversity.org/accounts/Ambystoma_tigrinum/"
        }
      ]
    },
    {
      id: "dragonfly",
      name: "Dragonfly",
      biome: "wetland",
      kind: "insect",
      rarity: "common",
      featured: true,
      diet: "Flying insects as adults; aquatic larvae eat mosquito larvae and tadpoles",
      shelter: "Emergent reed stems; larvae live in the water",
      preferredHabitat: "Clean water with reed perches",
      fact: "Dragonflies catch up to 95% of the prey they chase, among Earth's best hunters.",
      requirements: {
        minHealth: 35,
        objects: {
          "shallow-water-pool": 1,
          "reed-bed": 1,
          "sedge-tussock": 1
        },
        hint: "Clean water and reeds for the larvae to climb."
      },
      scientificName: "Anisoptera (Odonata)",
      role: "A top invertebrate predator both in the air and underwater. Adults hawk flying insects while aquatic nymphs devour mosquito larvae and tiny fish.",
      trophic: "insectivore",
      eats: [
        "damselfly"
      ],
      eatenBy: [
        "chorus-frog",
        "freshwater-fish",
        "great-blue-heron",
        "northern-leopard-frog"
      ],
      eatsOther: [
        "insect larvae",
        "insects"
      ],
      sources: [
        {
          name: "Natural History Museum - Dragonflies: The ultimate hunters",
          url: "https://www.nhm.ac.uk/discover/dragonflies-the-ultimate-hunters.html"
        }
      ]
    },
    {
      id: "damselfly",
      name: "Damselfly",
      biome: "wetland",
      kind: "insect",
      rarity: "common",
      diet: "Small flying insects as adults; larvae eat aquatic invertebrates",
      shelter: "Waterside vegetation; larvae among submerged plants",
      preferredHabitat: "Calm, clean shallows",
      fact: "Damselflies fold their wings together over the back at rest, unlike dragonflies.",
      requirements: {
        minHealth: 35,
        objects: {
          "shallow-water-pool": 1,
          "reed-bed": 1,
          "sedge-tussock": 1
        },
        hint: "Calm, clean water with plants at the edge."
      },
      scientificName: "Zygoptera (Odonata)",
      role: "A slender aerial insectivore that snatches midges and mosquitoes with its legs. Its aquatic nymphs hunt tiny invertebrates and feed marsh fish and frogs.",
      trophic: "insectivore",
      eatenBy: [
        "chorus-frog",
        "dragonfly",
        "freshwater-fish",
        "northern-leopard-frog"
      ],
      eatsOther: [
        "insect larvae",
        "insects"
      ],
      sources: [
        {
          name: "Britannica - Damselfly",
          url: "https://www.britannica.com/animal/damselfly"
        }
      ]
    },
    {
      id: "water-strider",
      name: "Water Strider",
      biome: "wetland",
      kind: "insect",
      rarity: "common",
      diet: "Insects and larvae trapped on the water surface; also scavenges",
      shelter: "Still water surfaces among emergent plants",
      preferredHabitat: "Any calm pool",
      fact: "Water striders ride the surface on legs coated in thousands of tiny hairs.",
      requirements: {
        minHealth: 12,
        objects: {
          "shallow-water-pool": 1
        },
        hint: "One calm pool is enough."
      },
      scientificName: "Gerridae (Hemiptera)",
      role: "A surface-skating predator and scavenger that seizes insects trapped in the water film. It is easy prey for fish, frogs, and wading birds.",
      trophic: "insectivore",
      eatenBy: [
        "chorus-frog",
        "freshwater-fish",
        "northern-leopard-frog"
      ],
      eatsOther: [
        "detritus",
        "insects"
      ],
      sources: [
        {
          name: "Britannica - Water strider",
          url: "https://www.britannica.com/animal/water-strider"
        },
        {
          name: "National Wildlife Federation - Water Striders",
          url: "https://www.nwf.org/Educational-Resources/Wildlife-Guide/Invertebrates/Water-Striders"
        }
      ]
    },
    {
      id: "freshwater-fish",
      name: "Freshwater Minnows",
      biome: "wetland",
      kind: "fish",
      rarity: "common",
      diet: "Algae, plankton, insect larvae, and small invertebrates",
      shelter: "Deeper pools and reed roots",
      preferredHabitat: "Connected clean pools",
      fact: "Minnow schools are the foundation that herons, otters, and mink all depend on.",
      requirements: {
        minHealth: 35,
        objects: {
          "shallow-water-pool": 2,
          "reed-bed": 1
        },
        hint: "Connected clean pools with reedy cover bring fish back \u2014 and everyone who eats them."
      },
      scientificName: "Leuciscidae",
      role: "The forage base of the wetland food web. These schooling fish graze algae and plankton and eat insect larvae, then feed nearly every predator in the marsh.",
      trophic: "omnivore",
      eats: [
        "damselfly",
        "dragonfly",
        "water-strider"
      ],
      eatenBy: [
        "american-bittern",
        "belted-kingfisher",
        "black-bear",
        "great-blue-heron",
        "green-heron",
        "hooded-merganser",
        "mink",
        "painted-turtle",
        "raccoon",
        "river-otter",
        "snapping-turtle"
      ],
      eatsOther: [
        "algae",
        "detritus",
        "insect larvae",
        "plankton"
      ],
      sources: [
        {
          name: "USGS - Minnow (Leuciscidae) trophic dynamics study",
          url: "https://www.usgs.gov/publications/effects-stream-intermittency-minnow-leuciscidae-and-darter-percidae-trophic-dynamics"
        },
        {
          name: "Encyclopaedia Britannica - Minnow",
          url: "https://www.britannica.com/animal/minnow"
        }
      ]
    }
  ]
};

// data/animals-2.json
var animals_2_default = {
  database: "wildwillows",
  table: "Animal",
  records: [
    {
      id: "desert-cottontail",
      name: "Desert Cottontail",
      biome: "desert",
      kind: "mammal",
      rarity: "common",
      featured: true,
      diet: "Grasses, mesquite, cactus pads, and other desert plants",
      shelter: "Brush cover and borrowed or natural burrows",
      preferredHabitat: "Brushy flats with shade and open forage",
      fact: "Desert cottontails get most of their water from the plants they eat.",
      requirements: {
        minHealth: 25,
        objects: {
          "desert-brush": 1,
          "burrow-mound": 1
        },
        hint: "Brush for cover and a burrow bank to shelter in."
      },
      scientificName: "Sylvilagus audubonii",
      role: "A common desert herbivore that grazes grasses and browse. It is a cornerstone prey species, feeding foxes, coyotes, bobcats, and raptors. Its abundance helps support the desert's predators.",
      trophic: "herbivore",
      eatenBy: [
        "coyote",
        "kit-fox",
        "rattlesnake"
      ],
      eatsOther: [
        "cactus pads",
        "grasses",
        "mesquite"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Sylvilagus audubonii",
          url: "https://animaldiversity.org/accounts/Sylvilagus_audubonii/"
        }
      ]
    },
    {
      id: "kit-fox",
      name: "Kit Fox",
      biome: "desert",
      kind: "mammal",
      rarity: "rare",
      featured: true,
      diet: "Kangaroo rats, rabbits, insects, and occasional fruit",
      shelter: "Cool underground dens with several entrances",
      preferredHabitat: "Open desert with abundant small prey",
      fact: "The smallest wild dog in North America, its huge ears both hear prey and shed heat.",
      requirements: {
        minHealth: 70,
        minBalance: 40,
        objects: {
          "desert-brush": 2,
          "burrow-mound": 1,
          "cactus-patch": 1
        },
        animals: [
          "kangaroo-rat",
          "desert-cottontail"
        ],
        hint: "Kit foxes return when prey is plentiful and dens are ready.",
        conditions: {
          dayPhase: [
            "dusk",
            "night"
          ]
        }
      },
      scientificName: "Vulpes macrotis",
      role: "A small nocturnal desert canid and mesopredator that hunts rodents and rabbits. It seldom needs to drink, getting moisture from prey. Coyotes are its main threat.",
      trophic: "mesopredator",
      eats: [
        "antelope-squirrel",
        "desert-cottontail",
        "desert-iguana",
        "desert-tortoise",
        "jackrabbit",
        "kangaroo-mouse",
        "kangaroo-rat"
      ],
      eatenBy: [
        "coyote"
      ],
      eatsOther: [
        "cactus fruit",
        "insects"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Vulpes macrotis",
          url: "https://animaldiversity.org/accounts/Vulpes_macrotis/"
        }
      ]
    },
    {
      id: "coyote",
      name: "Coyote",
      biome: "desert",
      kind: "mammal",
      rarity: "rare",
      diet: "Rodents, rabbits, fruit, carrion, and insects",
      shelter: "Brushy washes and rock dens",
      preferredHabitat: "Open desert with prey and cover",
      fact: "The most vocal wild mammal in North America; a howling pack sounds like many more.",
      requirements: {
        minHealth: 75,
        objects: {
          "desert-brush": 2,
          "shaded-rock-shelter": 1,
          "cactus-patch": 1
        },
        animals: [
          "jackrabbit"
        ],
        hint: "Cover, shade, and prey on the move."
      },
      scientificName: "Canis latrans",
      role: "The desert's most adaptable predator, an omnivore taking rodents, rabbits, fruit, and carrion. It is the top mammalian predator here and the main killer of kit foxes. Its howls carry for miles at dusk.",
      trophic: "apex-predator",
      eats: [
        "antelope-squirrel",
        "burrowing-owl",
        "chuckwalla",
        "desert-cottontail",
        "desert-tortoise",
        "gambels-quail",
        "horned-lizard",
        "jackrabbit",
        "kangaroo-rat",
        "kit-fox",
        "rattlesnake",
        "roadrunner"
      ],
      eatsOther: [
        "cactus fruit",
        "carrion",
        "insects"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Canis latrans",
          url: "https://animaldiversity.org/accounts/Canis_latrans/"
        }
      ]
    },
    {
      id: "kangaroo-rat",
      name: "Kangaroo Rat",
      biome: "desert",
      kind: "mammal",
      rarity: "common",
      featured: true,
      diet: "Seeds, carefully cached underground",
      shelter: "Deep burrow systems in loose soil",
      preferredHabitat: "Loose soil below seed-bearing brush",
      fact: "Kangaroo rats never sweat or pant and get by on water made from the dry seeds they eat.",
      requirements: {
        minHealth: 25,
        objects: {
          "burrow-mound": 1,
          "desert-brush": 1
        },
        hint: "Burrow banks and seed plants nearby."
      },
      scientificName: "Dipodomys merriami",
      role: "A seed-eating rodent and key desert prey species. It caches seeds underground, shaping which plants grow. It feeds nearly every desert predator, from rattlesnakes to owls to foxes.",
      trophic: "herbivore",
      eatenBy: [
        "burrowing-owl",
        "coyote",
        "kit-fox",
        "rattlesnake"
      ],
      eatsOther: [
        "mesquite",
        "seeds"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Dipodomys merriami",
          url: "https://animaldiversity.org/accounts/Dipodomys_merriami/"
        }
      ]
    },
    {
      id: "jackrabbit",
      name: "Black-tailed Jackrabbit",
      biome: "desert",
      kind: "mammal",
      rarity: "common",
      diet: "Grasses, cactus, and woody twigs and bark",
      shelter: "Shade forms scraped under brush",
      preferredHabitat: "Open flats with scattered brush",
      fact: "A jackrabbit's enormous ears act like radiators, releasing body heat to keep it cool.",
      requirements: {
        minHealth: 30,
        objects: {
          "desert-brush": 2
        },
        hint: "Open running room with brush for shade."
      },
      scientificName: "Lepus californicus",
      role: "A fast, open-country herbivore that browses grasses, twigs, and cactus. It is major prey for coyotes, bobcats, and large raptors. Its big ears both hear predators and dump heat.",
      trophic: "herbivore",
      eatenBy: [
        "coyote",
        "kit-fox"
      ],
      eatsOther: [
        "cactus pads",
        "grasses"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Lepus californicus",
          url: "https://animaldiversity.org/accounts/Lepus_californicus/"
        }
      ]
    },
    {
      id: "roadrunner",
      name: "Greater Roadrunner",
      biome: "desert",
      kind: "bird",
      rarity: "uncommon",
      featured: true,
      diet: "Lizards, insects, scorpions, and small snakes",
      shelter: "Low nests in brush and cactus",
      preferredHabitat: "Open hunting ground with brushy edges",
      fact: "It slams large prey against rocks to break the bones, and will kill and eat rattlesnakes.",
      requirements: {
        minHealth: 50,
        objects: {
          "desert-brush": 1,
          "cactus-patch": 1,
          "rock-pile": 1
        },
        animals: [
          "horned-lizard"
        ],
        hint: "Open desert, brush, and reptile prey about."
      },
      scientificName: "Geococcyx californianus",
      role: "A ground-running predatory bird that sprints down lizards, insects, scorpions, and snakes. It is a key mesopredator on small desert reptiles and arthropods. Coyotes and hawks hunt it.",
      trophic: "mesopredator",
      eats: [
        "banded-gecko",
        "cactus-wren",
        "collared-lizard",
        "gambels-quail",
        "horned-lizard",
        "rattlesnake",
        "scorpion",
        "tarantula"
      ],
      eatenBy: [
        "coyote"
      ],
      eatsOther: [
        "cactus fruit",
        "insects"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds \u2014 Greater Roadrunner",
          url: "https://www.allaboutbirds.org/guide/Greater_Roadrunner/lifehistory"
        },
        {
          name: "Audubon \u2014 Greater Roadrunner",
          url: "https://www.audubon.org/field-guide/bird/greater-roadrunner"
        }
      ]
    },
    {
      id: "burrowing-owl",
      name: "Burrowing Owl",
      biome: "desert",
      kind: "bird",
      rarity: "uncommon",
      featured: true,
      diet: "Insects and small rodents",
      shelter: "Underground burrows dug by other animals",
      preferredHabitat: "Burrow mounds with open hunting space",
      fact: "It hisses a raspy call that mimics a rattlesnake to scare intruders out of its burrow.",
      requirements: {
        minHealth: 55,
        objects: {
          "burrow-mound": 2,
          "desert-brush": 1
        },
        hint: "Ready-made burrows and open ground to hunt over."
      },
      scientificName: "Athene cunicularia",
      role: "A small ground-dwelling owl that nests in borrowed burrows and hunts insects by day and rodents at night. It is both an insectivore and a mesopredator on small mammals. Badgers and coyotes prey on it.",
      trophic: "insectivore",
      eats: [
        "kangaroo-mouse",
        "kangaroo-rat",
        "scorpion"
      ],
      eatenBy: [
        "coyote"
      ],
      eatsOther: [
        "insects"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds \u2014 Burrowing Owl",
          url: "https://www.allaboutbirds.org/guide/Burrowing_Owl/lifehistory"
        },
        {
          name: "Audubon \u2014 Burrowing Owl",
          url: "https://www.audubon.org/field-guide/bird/burrowing-owl"
        }
      ]
    },
    {
      id: "gambels-quail",
      name: "Gambel's Quail",
      biome: "desert",
      kind: "bird",
      rarity: "common",
      diet: "Seeds, leaves, and cactus fruit",
      shelter: "Dense brush thickets",
      preferredHabitat: "Brushy cover with seed plants",
      fact: "A male sentinel calls from a perch while the rest of the covey feeds below.",
      requirements: {
        minHealth: 40,
        objects: {
          "desert-brush": 2,
          "cactus-patch": 1,
          "rock-pile": 1
        },
        hint: "Thick brush to hide a whole covey."
      },
      scientificName: "Callipepla gambelii",
      role: "A social, ground-feeding quail that eats seeds, greens, and cactus fruit. It is important prey for coyotes, bobcats, and desert hawks. Coveys post a lookout while the flock forages.",
      trophic: "herbivore",
      eatenBy: [
        "coyote",
        "roadrunner"
      ],
      eatsOther: [
        "cactus fruit",
        "insects",
        "seeds"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds \u2014 Gambel's Quail",
          url: "https://www.allaboutbirds.org/guide/Gambels_Quail/lifehistory"
        },
        {
          name: "Audubon \u2014 Gambel's Quail",
          url: "https://www.audubon.org/field-guide/bird/gambels-quail"
        }
      ]
    },
    {
      id: "desert-tortoise",
      name: "Desert Tortoise",
      biome: "desert",
      kind: "reptile",
      rarity: "rare",
      diet: "Grasses, wildflowers, and cactus pads",
      shelter: "Long, cool burrows",
      preferredHabitat: "Native plants with shade and burrow ground",
      fact: "Desert tortoises can live 80 years and spend up to 98% of their lives in burrows.",
      requirements: {
        minHealth: 65,
        objects: {
          "burrow-mound": 1,
          "cactus-patch": 1,
          "shaded-rock-shelter": 1
        },
        hint: "Shade, native plants, and burrow habitat."
      },
      scientificName: "Gopherus agassizii",
      role: "A long-lived herbivore and ecosystem engineer. Its burrows, which can exceed 10 metres, shelter snakes, lizards, rodents, and insects. Adults are nearly predator-free, but eggs and young are widely eaten.",
      trophic: "herbivore",
      eatenBy: [
        "coyote",
        "kit-fox"
      ],
      eatsOther: [
        "cactus pads",
        "grasses",
        "wildflowers"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Gopherus agassizii",
          url: "https://animaldiversity.org/accounts/Gopherus_agassizii/"
        }
      ]
    },
    {
      id: "horned-lizard",
      name: "Horned Lizard",
      biome: "desert",
      kind: "reptile",
      rarity: "common",
      diet: "Mostly ants, plus other small insects",
      shelter: "Loose sand and rock edges",
      preferredHabitat: "Sunny open ground near ant trails",
      fact: "Texas horned lizards can squirt a jet of blood from their eyes to startle predators.",
      requirements: {
        minHealth: 16,
        objects: {
          "rock-pile": 1,
          "rock-crevice": 1
        },
        hint: "Sunny rocks and sandy ground bring the ants \u2014 and the lizards."
      },
      scientificName: "Phrynosoma cornutum",
      role: "A specialist insectivore that feeds mainly on harvester ants, with a large stomach to process them. It is prey for roadrunners, hawks, shrikes, and snakes. Its blood-squirting defense targets canid predators.",
      trophic: "insectivore",
      eatenBy: [
        "coyote",
        "roadrunner"
      ],
      eatsOther: [
        "insects"
      ],
      sources: [
        {
          name: "Sherbrooke & Middendorf 2001, Copeia \u2014 blood squirting (PDF)",
          url: "http://yubawatershedinstitute.org/wp-content/uploads/2015/04/Blood-squirting.pdf"
        },
        {
          name: "Wikipedia \u2014 Texas horned lizard",
          url: "https://en.wikipedia.org/wiki/Texas_horned_lizard"
        }
      ]
    },
    {
      id: "collared-lizard",
      name: "Collared Lizard",
      biome: "desert",
      kind: "reptile",
      rarity: "uncommon",
      diet: "Insects and smaller lizards",
      shelter: "Rock piles and ledges",
      preferredHabitat: "Boulder fields with lookout rocks",
      fact: "Collared lizards sprint on their hind legs like tiny dinosaurs, tail streaming behind.",
      requirements: {
        minHealth: 45,
        objects: {
          "rock-pile": 2,
          "desert-brush": 1
        },
        hint: "Plenty of warm rock to perch and hunt from."
      },
      scientificName: "Crotaphytus collaris",
      role: "An active, sit-and-wait predator of insects and smaller lizards among the rocks. It is a mesopredator on desert arthropods and hatchling reptiles. Hawks, snakes, and roadrunners prey on it.",
      trophic: "insectivore",
      eats: [
        "banded-gecko"
      ],
      eatenBy: [
        "rattlesnake",
        "roadrunner"
      ],
      eatsOther: [
        "insects"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Crotaphytus collaris",
          url: "https://animaldiversity.org/accounts/Crotaphytus_collaris/"
        }
      ]
    },
    {
      id: "rattlesnake",
      name: "Western Rattlesnake",
      biome: "desert",
      kind: "reptile",
      rarity: "rare",
      diet: "Rodents and small mammals",
      shelter: "Rock crevices and burrows",
      preferredHabitat: "Rocky shelter near busy rodent trails",
      fact: "It adds a rattle segment at each shed, but segments break, so you can't count its age.",
      requirements: {
        minHealth: 60,
        objects: {
          "shaded-rock-shelter": 1,
          "rock-pile": 1,
          "desert-brush": 1
        },
        animals: [
          "kangaroo-rat"
        ],
        hint: "Rocky shelter and rodents to hunt."
      },
      scientificName: "Crotalus atrox",
      role: "A venomous ambush predator and key control on desert rodent populations. It swallows prey whole and eats only every few weeks. Roadrunners, hawks, and coyotes are among its predators.",
      trophic: "mesopredator",
      eats: [
        "antelope-squirrel",
        "banded-gecko",
        "cactus-wren",
        "chuckwalla",
        "collared-lizard",
        "desert-cottontail",
        "desert-iguana",
        "gila-woodpecker",
        "kangaroo-mouse",
        "kangaroo-rat"
      ],
      eatenBy: [
        "coyote",
        "roadrunner"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Crotalus atrox",
          url: "https://animaldiversity.org/accounts/Crotalus_atrox/"
        }
      ]
    },
    {
      id: "tarantula",
      name: "Desert Tarantula",
      biome: "desert",
      kind: "invertebrate",
      rarity: "uncommon",
      diet: "Insects and other small invertebrates",
      shelter: "Silk-lined ground burrows",
      preferredHabitat: "Undisturbed ground with burrow banks",
      fact: "A desert tarantula may live 25 years, most of it within a few feet of one burrow.",
      requirements: {
        minHealth: 45,
        objects: {
          "burrow-mound": 1,
          "desert-brush": 1
        },
        hint: "Quiet, diggable ground."
      },
      scientificName: "Aphonopelma chalcodes",
      role: "A long-lived, nocturnal ambush predator of insects and other invertebrates from its burrow. It is a mesopredator on desert arthropods. Birds, snakes, and the tarantula hawk wasp prey on it.",
      trophic: "insectivore",
      eats: [
        "scorpion"
      ],
      eatenBy: [
        "roadrunner"
      ],
      eatsOther: [
        "insects"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Aphonopelma chalcodes",
          url: "https://animaldiversity.org/accounts/Aphonopelma_chalcodes/"
        }
      ]
    },
    {
      id: "scorpion",
      name: "Desert Scorpion",
      biome: "desert",
      kind: "invertebrate",
      rarity: "common",
      diet: "Insects, spiders, and other small invertebrates",
      shelter: "Burrows and cover under rocks and bark",
      preferredHabitat: "Rocky cover with night hunting ground",
      fact: "Scorpions glow blue-green under ultraviolet light, and no one is entirely sure why.",
      requirements: {
        minHealth: 12,
        objects: {
          "rock-pile": 1
        },
        hint: "Rocks to hide beneath by day."
      },
      scientificName: "Hadrurus arizonensis",
      role: "The largest scorpion in North America, a nocturnal ambush predator of insects, spiders, and even other scorpions. It is a mesopredator on desert arthropods and small prey. Owls, lizards, and roadrunners hunt it.",
      trophic: "insectivore",
      eatenBy: [
        "banded-gecko",
        "burrowing-owl",
        "elf-owl",
        "roadrunner",
        "tarantula"
      ],
      eatsOther: [
        "insects"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Hadrurus arizonensis",
          url: "https://animaldiversity.org/accounts/Hadrurus_arizonensis/"
        }
      ]
    },
    {
      id: "desert-bee",
      name: "Desert Bee",
      biome: "desert",
      kind: "insect",
      rarity: "common",
      diet: "Cactus flower nectar and pollen",
      shelter: "Tiny solitary ground nests",
      preferredHabitat: "Blooming cactus and brush",
      fact: "Solitary cactus bees nest alone but gather by the thousands in shared ground colonies.",
      requirements: {
        minHealth: 20,
        objects: {
          "cactus-patch": 1
        },
        hint: "Cactus blooms are the desert's flower patch."
      },
      scientificName: "Diadasia rinconis",
      role: "A solitary native bee and key pollinator of desert cacti such as prickly pear and cholla. As a herbivore on nectar and pollen, it sustains cactus reproduction. Lizards, birds, and spiders prey on it.",
      trophic: "herbivore",
      eatenBy: [
        "banded-gecko",
        "cactus-wren"
      ],
      eatsOther: [
        "cactus flower nectar",
        "pollen"
      ],
      sources: [
        {
          name: "Arizona-Sonora Desert Museum \u2014 Bees",
          url: "https://www.desertmuseum.org/books/nhsd_bees.php"
        }
      ]
    },
    {
      id: "mountain-goat",
      name: "Mountain Goat",
      biome: "alpine",
      kind: "mammal",
      rarity: "rare",
      featured: true,
      diet: "Alpine grasses, sedges, forbs, woody browse, mosses, and lichens",
      shelter: "Shallow bedding depressions pawed into cliff ledges and rocky terrain",
      preferredHabitat: "Steep alpine and subalpine cliffs with escape terrain above turf",
      fact: "Both sexes grow permanent black horns; you can count the annual rings to age one.",
      requirements: {
        minHealth: 70,
        objects: {
          "rock-pile": 2,
          "alpine-wildflower-patch": 2,
          "heather-mat": 1
        },
        hint: "Rocky terrain and restored alpine vegetation."
      },
      scientificName: "Oreamnos americanus",
      role: "A sure-footed alpine grazer of the highest cliffs, browsing grasses, forbs, and lichens across the rock. Its rubbery-padded hooves grip terrain few predators can follow. Kids and adults are still taken by cougars, and eagles snatch newborns from ledges.",
      trophic: "herbivore",
      eatenBy: [
        "golden-eagle"
      ],
      eatsOther: [
        "alpine plants",
        "grasses",
        "lichen",
        "moss",
        "sedges"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Oreamnos americanus",
          url: "https://animaldiversity.org/accounts/Oreamnos_americanus/"
        }
      ]
    },
    {
      id: "bighorn-sheep",
      name: "Bighorn Sheep",
      biome: "alpine",
      kind: "mammal",
      rarity: "rare",
      diet: "Chiefly grasses and sedges, with forbs and woody browse in winter",
      shelter: "Beds on rocky ledges and rugged escape terrain near cliffs",
      preferredHabitat: "Open grassy mountain slopes beside rugged, rocky cliffs",
      fact: "Bighorns flee across rocky ledges barely a few inches wide to escape predators.",
      requirements: {
        minHealth: 75,
        objects: {
          "rock-pile": 2,
          "grass-patch": 2,
          "alpine-wildflower-patch": 1
        },
        hint: "Grassy slopes with rocky escape ground."
      },
      scientificName: "Ovis canadensis",
      role: "A cliff-edge grazer that crops grasses and forbs on open slopes, never far from rugged escape terrain. Rams clash horns in booming rutting contests each fall. Lambs and adults are hunted by cougars, and eagles may take the very young.",
      trophic: "herbivore",
      eatenBy: [
        "golden-eagle"
      ],
      eatsOther: [
        "alpine plants",
        "grasses",
        "sedges"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Ovis canadensis",
          url: "https://animaldiversity.org/accounts/Ovis_canadensis/"
        },
        {
          name: "National Wildlife Federation - Bighorn Sheep",
          url: "https://www.nwf.org/Educational-Resources/Wildlife-Guide/Mammals/bighorn-sheep"
        }
      ]
    },
    {
      id: "pika",
      name: "American Pika",
      biome: "alpine",
      kind: "mammal",
      rarity: "common",
      featured: true,
      diet: "Grasses, forbs, and wildflowers, gathered and dried into winter haypiles",
      shelter: "Cool gaps deep within talus and broken rock",
      preferredHabitat: "Talus slopes and rock piles bordering alpine flower meadows",
      fact: "Pikas cut and sun-dry little haystacks of plants to eat beneath the winter snow.",
      requirements: {
        minHealth: 14,
        objects: {
          "talus-pile": 1,
          "rock-pile": 1
        },
        hint: "Cool rock piles and flowers to harvest."
      },
      scientificName: "Ochotona princeps",
      role: "A tiny talus-dwelling relative of rabbits and the engine of the alpine food web. It spends summer harvesting haypiles of forbs and grasses to survive under snow. Pikas are hunted by weasels, martens, foxes, and eagles alike.",
      trophic: "herbivore",
      eatenBy: [
        "ermine",
        "fox-alpine",
        "golden-eagle",
        "pine-marten"
      ],
      eatsOther: [
        "alpine plants",
        "grasses",
        "lichen",
        "wildflowers"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Ochotona princeps",
          url: "https://animaldiversity.org/accounts/Ochotona_princeps/"
        }
      ]
    },
    {
      id: "marmot",
      name: "Yellow-bellied Marmot",
      biome: "alpine",
      kind: "mammal",
      rarity: "common",
      featured: true,
      diet: "Grasses, flowering plants, and seeds in late summer",
      shelter: "Deep burrow systems dug beneath boulders",
      preferredHabitat: "Open meadow patches with boulders and burrow ground",
      fact: "Predation causes about 98% of yellow-bellied marmots' summer deaths.",
      requirements: {
        minHealth: 35,
        objects: {
          "burrow-mound": 1,
          "alpine-wildflower-patch": 1
        },
        hint: "Burrows, meadow patches, and open space."
      },
      scientificName: "Marmota flaviventris",
      role: "A stout, sun-loving rodent that grazes meadow plants and fattens on seeds before an eight-month hibernation. Colonies whistle alarm calls from boulder lookouts. They are prime prey for golden eagles, coyotes, and foxes.",
      trophic: "herbivore",
      eatenBy: [
        "fox-alpine",
        "golden-eagle"
      ],
      eatsOther: [
        "alpine plants",
        "grasses",
        "seeds",
        "wildflowers"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Marmota flaviventris",
          url: "https://animaldiversity.org/accounts/Marmota_flaviventris/"
        }
      ]
    },
    {
      id: "snowshoe-hare",
      name: "Snowshoe Hare",
      biome: "alpine",
      kind: "mammal",
      rarity: "uncommon",
      diet: "Green plants in summer; buds, twigs, bark, and conifer needles in winter",
      shelter: "Shallow forms under dense shrubs and conifer cover",
      preferredHabitat: "Brushy thickets and dense understory near open turf",
      fact: "Its molt from brown to winter white is triggered by day length, not snow.",
      requirements: {
        minHealth: 40,
        objects: {
          "grass-patch": 2,
          "rock-pile": 1
        },
        hint: "Cover and forage at the treeline."
      },
      scientificName: "Lepus americanus",
      role: "A browsing hare of brushy treeline cover whose coat flips brown-to-white with the seasons. Its numbers cycle roughly every ten years, driving predator populations. Martens, foxes, eagles, and owls all hunt it.",
      trophic: "herbivore",
      eatenBy: [
        "golden-eagle",
        "pine-marten"
      ],
      eatsOther: [
        "alpine plants",
        "bark",
        "buds",
        "grasses"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Lepus americanus",
          url: "https://animaldiversity.org/accounts/Lepus_americanus/"
        },
        {
          name: "USFS Fire Effects Information System - Lepus americanus",
          url: "https://research.fs.usda.gov/feis/species-reviews/leam"
        }
      ]
    },
    {
      id: "elk-alpine",
      name: "Elk",
      biome: "alpine",
      kind: "mammal",
      rarity: "rare",
      diet: "Grasses, sedges, and forbs in summer; browse, bark, and lichens in winter",
      shelter: "Beds in timber edges and shaded cover beside meadows",
      preferredHabitat: "High summer meadows near forest cover and snowmelt water",
      fact: "Elk chase the 'green wave' of new growth up the mountains each summer.",
      requirements: {
        minHealth: 70,
        objects: {
          "grass-patch": 2,
          "snowmelt-pool": 1,
          "rock-pile": 1
        },
        hint: "High meadow forage and snowmelt water."
      },
      scientificName: "Cervus canadensis",
      role: "A large migratory grazer that summers in high meadows, following fresh growth uphill and bugling through the autumn rut. Bulls regrow massive antlers yearly. Cougars take adults, while eagles and coyotes may take newborn calves.",
      trophic: "herbivore",
      eatsOther: [
        "alpine plants",
        "bark",
        "grasses",
        "sedges"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Cervus",
          url: "https://animaldiversity.org/accounts/Cervus_elaphus/"
        },
        {
          name: "WDFW - Elk (Cervus canadensis)",
          url: "https://wdfw.wa.gov/species-habitats/species/cervus-canadensis"
        }
      ]
    },
    {
      id: "mule-deer-alpine",
      name: "Mule Deer",
      biome: "alpine",
      kind: "mammal",
      rarity: "uncommon",
      diet: "A selective browser of shrubs, forbs, buds, fruits, and lichens",
      shelter: "Beds in shaded thickets and krummholz cover",
      preferredHabitat: "High summer meadows and shrublands with clean water",
      fact: "Mule deer clear obstacles with a bounding, four-footed gait called stotting.",
      requirements: {
        minHealth: 55,
        objects: {
          "grass-patch": 1,
          "alpine-wildflower-patch": 1,
          "snowmelt-pool": 1
        },
        hint: "Forage and clean water up high."
      },
      scientificName: "Odocoileus hemionus",
      role: "A selective high-country browser that summers in alpine meadows and shrublands before migrating down each fall. It picks the most digestible forbs, buds, and browse. Cougars are its main predator; fawns are also taken by eagles and coyotes.",
      trophic: "herbivore",
      eatenBy: [
        "golden-eagle"
      ],
      eatsOther: [
        "alpine plants",
        "buds",
        "lichen",
        "shrubs"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Odocoileus hemionus",
          url: "https://animaldiversity.org/accounts/Odocoileus_hemionus/"
        },
        {
          name: "CDFW - Mule Deer Natural History",
          url: "https://wildlife.ca.gov/Regions/6/Mule-Deer/Natural-History"
        }
      ]
    },
    {
      id: "fox-alpine",
      name: "Red Fox",
      biome: "alpine",
      kind: "mammal",
      rarity: "rare",
      diet: "Voles, pikas, hares, ground birds and eggs, insects, and berries",
      shelter: "Earthen dens, often burrows co-opted from other animals",
      preferredHabitat: "High country with rocky cover and abundant small prey",
      fact: "Red foxes often move into burrows dug by rabbits or marmots instead of digging.",
      requirements: {
        minHealth: 65,
        objects: {
          "rock-pile": 1,
          "alpine-wildflower-patch": 1
        },
        animals: [
          "pika",
          "marmot"
        ],
        hint: "Foxes follow the pikas and marmots."
      },
      scientificName: "Vulpes vulpes",
      role: "An adaptable mountain mesopredator that hunts pikas, marmots, and ground birds and rounds out its diet with insects and berries. It listens for prey moving beneath the snow, then dives in headfirst. Golden eagles are its main threat here.",
      trophic: "mesopredator",
      eats: [
        "alpine-chipmunk",
        "american-pipit",
        "boreal-toad",
        "cascades-frog",
        "ermine",
        "marmot",
        "mountain-chickadee",
        "pika",
        "pine-grosbeak",
        "ptarmigan",
        "white-crowned-sparrow"
      ],
      eatenBy: [
        "golden-eagle"
      ],
      eatsOther: [
        "berries",
        "insects",
        "seeds",
        "voles"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Vulpes vulpes",
          url: "https://animaldiversity.org/accounts/Vulpes_vulpes/"
        },
        {
          name: "USFWS - Sierra Nevada Red Fox",
          url: "https://www.fws.gov/species/sierra-nevada-red-fox-vulpes-vulpes-necator"
        }
      ]
    },
    {
      id: "pine-marten",
      name: "Pine Marten",
      biome: "alpine",
      kind: "mammal",
      rarity: "rare",
      diet: "Voles, red squirrels, pikas, hares, birds, eggs, insects, and berries",
      shelter: "Dens in tree cavities, hollow logs, stumps, and rock crevices",
      preferredHabitat: "Structurally complex treeline forest with rocky cover",
      fact: "Pine martens hunt beneath the winter snowpack through tunnels others can't reach.",
      requirements: {
        minHealth: 70,
        objects: {
          "rock-pile": 2,
          "alpine-wildflower-patch": 1
        },
        animals: [
          "snowshoe-hare"
        ],
        hint: "Rocky cover and prey near the treeline."
      },
      scientificName: "Martes americana",
      role: "An agile treeline weasel that hunts voles, squirrels, pikas, and young hares, adding berries and insects in season. It ranges over complex forest and rock, even beneath the snowpack. Great horned owls, eagles, and larger carnivores prey on it.",
      trophic: "mesopredator",
      eats: [
        "alpine-chipmunk",
        "ermine",
        "mountain-chickadee",
        "pika",
        "pine-grosbeak",
        "ptarmigan",
        "snowshoe-hare",
        "white-crowned-sparrow"
      ],
      eatenBy: [
        "golden-eagle"
      ],
      eatsOther: [
        "berries",
        "insects",
        "squirrels",
        "voles"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Martes americana",
          url: "https://animaldiversity.org/accounts/Martes_americana/"
        },
        {
          name: "Alaska Dept. of Fish & Game - American Marten",
          url: "https://www.adfg.alaska.gov/index.cfm?adfg=americanmarten.main"
        }
      ]
    },
    {
      id: "ptarmigan",
      name: "White-tailed Ptarmigan",
      biome: "alpine",
      kind: "bird",
      rarity: "uncommon",
      featured: true,
      diet: "Buds, twigs, leaves, seeds, and flowers; willow is the sole winter food",
      shelter: "Camouflaged ground scrapes among lichen-covered alpine rocks",
      preferredHabitat: "Alpine tundra above treeline year-round, wintering in willow basins",
      fact: "It is the only North American bird living entirely above treeline all year.",
      requirements: {
        minHealth: 55,
        objects: {
          "alpine-wildflower-patch": 1,
          "grass-patch": 1,
          "rock-pile": 1,
          "frostflower-planter": 1
        },
        hint: "Alpine shrubs and quiet nesting cover, with hardy frostflowers in bloom."
      },
      scientificName: "Lagopus leucura",
      role: "A superbly camouflaged alpine grouse that grazes buds, leaves, and seeds, surviving winter almost entirely on willow. It grows feathered 'snowshoes' on its feet each winter. Eagles, foxes, weasels, and martens all hunt it and its chicks.",
      trophic: "herbivore",
      eatenBy: [
        "ermine",
        "fox-alpine",
        "golden-eagle",
        "pine-marten"
      ],
      eatsOther: [
        "alpine plants",
        "buds",
        "insects",
        "seeds"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds - White-tailed Ptarmigan",
          url: "https://www.allaboutbirds.org/guide/White-tailed_Ptarmigan/lifehistory"
        },
        {
          name: "Animal Diversity Web - Lagopus leucura",
          url: "https://animaldiversity.org/accounts/Lagopus_leucura/"
        }
      ]
    },
    {
      id: "clarks-nutcracker",
      name: "Clark's Nutcracker",
      biome: "alpine",
      kind: "bird",
      rarity: "uncommon",
      diet: "Pine seeds cached by the thousand, plus insects and small animals",
      shelter: "Cup nest in conifer branches, sited near winter seed caches",
      preferredHabitat: "High conifer forest and treeline near pine-seed sources",
      fact: "It can relocate thousands of buried seed caches months later, even under snow.",
      requirements: {
        minHealth: 50,
        objects: {
          "rock-pile": 1,
          "alpine-wildflower-patch": 1,
          "heather-mat": 1
        },
        hint: "A recovering treeline with seeds to cache."
      },
      scientificName: "Nucifraga columbiana",
      role: "A mountain corvid that harvests and buries thousands of pine seeds, replanting the very forests it depends on. Its cached hoard lets it breed in deep winter. It also takes insects and small vertebrates when available.",
      trophic: "omnivore",
      eatsOther: [
        "insects",
        "pine seeds",
        "seeds"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds - Clark's Nutcracker",
          url: "https://www.allaboutbirds.org/guide/Clarks_Nutcracker/lifehistory"
        },
        {
          name: "Animal Diversity Web - Nucifraga columbiana",
          url: "https://animaldiversity.org/accounts/Nucifraga_columbiana/"
        }
      ]
    },
    {
      id: "golden-eagle",
      name: "Golden Eagle",
      biome: "alpine",
      kind: "bird",
      rarity: "rare",
      diet: "Marmots, hares, ground squirrels, ptarmigan and other birds, plus carrion",
      shelter: "Huge stick eyries on cliffs and steep escarpments",
      preferredHabitat: "Open, high country with cliffs and abundant medium prey",
      fact: "Golden eagles sometimes line their nests with aromatic leaves, perhaps to deter insects.",
      requirements: {
        minHealth: 75,
        minBalance: 45,
        objects: {
          "rock-pile": 2,
          "alpine-wildflower-patch": 1
        },
        animals: [
          "marmot",
          "snowshoe-hare"
        ],
        hint: "Eagles arrive last \u2014 when the high country is truly alive again."
      },
      scientificName: "Aquila chrysaetos",
      role: "The apex hunter of the high country, taking marmots, hares, and ptarmigan and even smaller carnivores in powerful stoops. It arrives only when the mountain teems with prey. Adults have essentially no predators.",
      trophic: "apex-predator",
      eats: [
        "alpine-chipmunk",
        "bighorn-sheep",
        "ermine",
        "fox-alpine",
        "marmot",
        "mountain-goat",
        "mule-deer-alpine",
        "pika",
        "pine-grosbeak",
        "pine-marten",
        "ptarmigan",
        "snowshoe-hare"
      ],
      eatsOther: [
        "carrion",
        "ground squirrels"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds - Golden Eagle",
          url: "https://www.allaboutbirds.org/guide/Golden_Eagle/lifehistory"
        },
        {
          name: "Birds of the World - Golden Eagle Food Habits",
          url: "https://birdsoftheworld.org/bow/species/goleag/cur/foodhabits"
        }
      ]
    },
    {
      id: "alpine-butterfly",
      name: "Alpine Butterfly",
      biome: "alpine",
      kind: "insect",
      rarity: "common",
      diet: "Larvae eat stonecrop; adults sip nectar from Sedum and daisy-family flowers",
      shelter: "No nest; larvae shelter in leaf litter and rocks, overwintering as eggs",
      preferredHabitat: "Rocky open alpine and montane slopes where stonecrop grows",
      fact: "Its pale red-and-black wings warn predators that it tastes unpalatable.",
      requirements: {
        minHealth: 25,
        objects: {
          "alpine-wildflower-patch": 1
        },
        hint: "Alpine flowers in bloom."
      },
      scientificName: "Parnassius smintheus",
      role: "A hardy alpine butterfly whose caterpillars feed only on stonecrop while adults nectar across the meadow flowers. Its aposematic wings advertise a foul taste. Birds and spiders that ignore the warning still catch some.",
      trophic: "herbivore",
      eatsOther: [
        "alpine plants",
        "nectar"
      ],
      sources: [
        {
          name: "Butterflies and Moths of North America - Parnassius smintheus",
          url: "https://www.butterfliesandmoths.org/species/Parnassius-smintheus"
        },
        {
          name: "Washington Butterfly Assoc. - Mountain Parnassian",
          url: "https://wabutterflyassoc.org/species-profile-mountain-parnassian-parnassius-smintheus/"
        }
      ]
    },
    {
      id: "bumblebee-alpine",
      name: "Alpine Bumblebee",
      biome: "alpine",
      kind: "insect",
      rarity: "common",
      diet: "Nectar and pollen from deep-throated alpine flowers",
      shelter: "Colonial nests in ground cavities and old rodent burrows",
      preferredHabitat: "High alpine and boreal flower meadows, often above treeline",
      fact: "This bee's tongue grew measurably shorter from 1966 to 2014 as flowers declined.",
      requirements: {
        minHealth: 25,
        objects: {
          "alpine-wildflower-patch": 2
        },
        hint: "More flowers, more bees \u2014 even up here."
      },
      scientificName: "Bombus balteatus",
      role: "A cold-tolerant, long-tongued bumblebee that pollinates deep alpine blossoms, shivering its flight muscles to fly in near-freezing air. Its colonies nest underground. Birds, crab spiders, and robber flies prey on foragers.",
      trophic: "herbivore",
      eatsOther: [
        "alpine plants",
        "nectar",
        "pollen"
      ],
      sources: [
        {
          name: "Molecular Ecology - Alpine bumblebee tongue-length study",
          url: "https://onlinelibrary.wiley.com/doi/full/10.1111/mec.16291"
        },
        {
          name: "Bombus balteatus - Wikipedia",
          url: "https://en.wikipedia.org/wiki/Bombus_balteatus"
        }
      ]
    },
    {
      id: "snowmelt-trout",
      name: "Cutthroat Trout",
      biome: "alpine",
      kind: "fish",
      rarity: "uncommon",
      diet: "Aquatic and terrestrial insects; larger fish add small fish to the diet",
      shelter: "Cold, clear pools and undercut banks; gravel riffles for spawning",
      preferredHabitat: "Cold, clear, connected snowmelt streams and mountain lakes",
      fact: "A poor competitor, native cutthroat are displaced by introduced brown and brook trout.",
      requirements: {
        minHealth: 60,
        objects: {
          "snowmelt-pool": 2,
          "rock-pile": 1
        },
        hint: "Cold, clean, connected snowmelt pools."
      },
      scientificName: "Oncorhynchus clarkii",
      role: "A cold-water native whose presence signals a clean, healthy mountain stream. It picks off drifting insects and, when large, smaller fish. It is threatened by non-native trout that out-compete and prey on it.",
      trophic: "insectivore",
      eats: [
        "cascades-frog"
      ],
      eatsOther: [
        "aquatic insects",
        "crustaceans",
        "insects"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Oncorhynchus clarkii",
          url: "https://animaldiversity.org/accounts/Oncorhynchus_clarkii/"
        },
        {
          name: "USGS - Cutthroat trout diet study",
          url: "https://www.usgs.gov/publications/changing-patterns-coastal-cutthroat-trout-oncorhynchus-clarki-clarki-diet-and-prey-a"
        }
      ]
    },
    {
      id: "tidepool-crab",
      name: "Shore Crab",
      biome: "coastal",
      kind: "invertebrate",
      rarity: "common",
      featured: true,
      diet: "Mostly algae, plus detritus, worms, snails, and carrion",
      shelter: "Tidepool rocks and crevices",
      preferredHabitat: "Rocky tidepools and intertidal splash zone",
      fact: "Striped shore crabs graze algae but will scavenge and even turn cannibal after molting.",
      requirements: {
        minHealth: 12,
        objects: {
          tidepool: 1
        },
        hint: "Restore the tidepools and the crabs scuttle back first."
      },
      scientificName: "Pachygrapsus crassipes",
      role: "An abundant intertidal grazer-scavenger that keeps rock surfaces clear of algae and recycles carrion. It is a key prey item for gulls, shorebirds, and larger crabs, linking algae to higher predators.",
      trophic: "omnivore",
      eatenBy: [
        "anemone",
        "black-oystercatcher",
        "black-turnstone",
        "gull"
      ],
      eatsOther: [
        "algae",
        "kelp"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Pachygrapsus crassipes",
          url: "https://animaldiversity.org/accounts/Pachygrapsus_crassipes/"
        }
      ]
    },
    {
      id: "hermit-crab",
      name: "Hermit Crab",
      biome: "coastal",
      kind: "invertebrate",
      rarity: "common",
      diet: "Algae, detritus, and scavenged carrion",
      shelter: "Borrowed empty snail shells",
      preferredHabitat: "Tidepools with a supply of empty shells",
      fact: "When a better shell appears, hermit crabs line up by size and swap shells down the chain.",
      requirements: {
        minHealth: 35,
        objects: {
          tidepool: 1,
          "kelp-wrack": 1,
          "dune-grass": 1
        },
        hint: "Tidepools plus washed-up shells to move into."
      },
      scientificName: "Pagurus samuelis",
      role: "A tidepool scavenger that cleans up algae and carrion and recycles empty snail shells as portable armor. It is common prey for gulls, fish, and octopus in the intertidal food web.",
      trophic: "scavenger",
      eatenBy: [
        "black-turnstone",
        "gull"
      ],
      eatsOther: [
        "algae"
      ],
      sources: [
        {
          name: "iNaturalist - Blueband Hermit Crab (Pagurus samuelis)",
          url: "https://www.inaturalist.org/taxa/49095-Pagurus-samuelis"
        }
      ]
    },
    {
      id: "sea-star",
      name: "Ochre Sea Star",
      biome: "coastal",
      kind: "invertebrate",
      rarity: "uncommon",
      featured: true,
      diet: "Mussels, barnacles, limpets, chitons, and snails",
      shelter: "Tidepool rock faces and crevices",
      preferredHabitat: "Wave-washed rocky intertidal with shellfish",
      fact: "The classic keystone predator: removing it lets mussels overrun the whole shore.",
      requirements: {
        minHealth: 50,
        objects: {
          tidepool: 2,
          "dune-grass": 1
        },
        animals: [
          "mussel"
        ],
        hint: "Sea stars need established pools with mussels to eat."
      },
      scientificName: "Pisaster ochraceus",
      role: "The textbook keystone predator of the rocky shore. By eating mussels it sets the mussel bed's lower limit and keeps space open for many other species, maintaining intertidal biodiversity.",
      trophic: "mesopredator",
      eats: [
        "mussel"
      ],
      eatenBy: [
        "gull",
        "sea-otter"
      ],
      eatsOther: [
        "barnacles",
        "mussels"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Pisaster ochraceus",
          url: "https://animaldiversity.org/accounts/Pisaster_ochraceus/"
        }
      ]
    },
    {
      id: "anemone",
      name: "Giant Green Anemone",
      biome: "coastal",
      kind: "invertebrate",
      rarity: "common",
      diet: "Crabs, detached mussels, and small fish stung by its tentacles",
      shelter: "Tidepool walls, often below mussel beds",
      preferredHabitat: "Clear, surge-fed tidepools near mussel beds",
      fact: "Its green glow comes from algae living inside its tissues that share sugars.",
      requirements: {
        minHealth: 30,
        objects: {
          tidepool: 1
        },
        hint: "Clear, quiet pools."
      },
      scientificName: "Anthopleura xanthogrammica",
      role: "A sit-and-wait carnivore of tidepools that ambushes prey washed off the rocks, while also farming symbiotic algae for extra food. It is a minor predator that helps recycle dislodged shellfish and crabs.",
      trophic: "mesopredator",
      eats: [
        "mussel",
        "purple-shore-crab",
        "tidepool-crab"
      ],
      eatsOther: [
        "mussels"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Anthopleura xanthogrammica",
          url: "https://animaldiversity.org/accounts/Anthopleura_xanthogrammica/"
        },
        {
          name: "Monterey Bay Aquarium - Giant green anemone",
          url: "https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/giant-green-anemone"
        }
      ]
    },
    {
      id: "mussel",
      name: "California Mussel",
      biome: "coastal",
      kind: "invertebrate",
      rarity: "common",
      diet: "Plankton filtered from seawater",
      shelter: "Dense beds anchored to wave-washed rock",
      preferredHabitat: "Exposed rocky shore with clean moving water",
      fact: "A single mussel filters several liters of seawater an hour as it feeds.",
      requirements: {
        minHealth: 30,
        objects: {
          tidepool: 1
        },
        hint: "Clean water over rocky shore."
      },
      scientificName: "Mytilus californianus",
      role: "A reef-building filter feeder whose beds create habitat for countless small animals. It is the key prey that ties together the shore's top predators, from ochre sea stars to sea otters and oystercatchers.",
      trophic: "filter-feeder",
      eatenBy: [
        "anemone",
        "black-oystercatcher",
        "black-turnstone",
        "gull",
        "sea-otter",
        "sea-star"
      ],
      eatsOther: [
        "plankton"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Mytilus californianus",
          url: "https://animaldiversity.org/accounts/Mytilus_californianus/"
        },
        {
          name: "Monterey Bay Aquarium - California mussel",
          url: "https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/california-mussel"
        }
      ]
    },
    {
      id: "clam",
      name: "Pacific Littleneck Clam",
      biome: "coastal",
      kind: "invertebrate",
      rarity: "common",
      diet: "Plankton filtered from seawater",
      shelter: "Buried in sand and gravel",
      preferredHabitat: "Stable sand and gravel near tidepools",
      fact: "You can estimate a littleneck clam's age by counting the growth rings on its shell.",
      requirements: {
        minHealth: 30,
        objects: {
          tidepool: 1,
          "dune-grass": 1
        },
        hint: "Stable, quiet sand to dig into."
      },
      scientificName: "Leukoma staminea",
      role: "A buried filter feeder that helps clean coastal water and stores energy in sheltered sediment. It is important prey for sea otters, shorebirds, crabs, and gulls that dig or crack it open.",
      trophic: "filter-feeder",
      eatenBy: [
        "gull",
        "sea-otter"
      ],
      eatsOther: [
        "plankton"
      ],
      sources: [
        {
          name: "WDFW - Pacific littleneck clam",
          url: "https://wdfw.wa.gov/species-habitats/species/leukoma-staminea"
        },
        {
          name: "Animal Diversity Web - Enhydra lutris (predation on clams)",
          url: "https://animaldiversity.org/accounts/Enhydra_lutris/"
        }
      ]
    },
    {
      id: "shorebird",
      name: "Snowy Plover",
      biome: "coastal",
      kind: "bird",
      rarity: "uncommon",
      featured: true,
      diet: "Sand crustaceans, mole crabs, and kelp-fly larvae",
      shelter: "Shallow scrapes hidden on open sand",
      preferredHabitat: "Undisturbed sandy beaches and dune edges",
      fact: "Snowy plover chicks can run and feed themselves within hours of hatching.",
      requirements: {
        minHealth: 50,
        objects: {
          "dune-grass": 2,
          "coastal-nesting-area": 1,
          tidepool: 1
        },
        hint: "Anchored dunes and a protected stretch of quiet beach."
      },
      scientificName: "Charadrius nivosus",
      role: "A small beach forager that snaps up tiny crustaceans and kelp flies along the tide line. A threatened species and sensitive indicator of quiet, undisturbed beach; its nests fail easily where beaches are busy.",
      trophic: "insectivore",
      eatsOther: [
        "fly larvae",
        "mole crabs"
      ],
      sources: [
        {
          name: "All About Birds - Snowy Plover Life History",
          url: "https://www.allaboutbirds.org/guide/Snowy_Plover/lifehistory"
        },
        {
          name: "USFWS - Western Snowy Plover",
          url: "https://www.fws.gov/species/western-snowy-plover-charadrius-nivosus-nivosus"
        }
      ]
    },
    {
      id: "gull",
      name: "Western Gull",
      biome: "coastal",
      kind: "bird",
      rarity: "common",
      diet: "Fish, crabs, clams, sea stars, and carrion",
      shelter: "Open beach, rocky points, and islands",
      preferredHabitat: "Any shoreline with food to scavenge or catch",
      fact: "Western gulls crack clams by dropping them from the air onto rocks below.",
      requirements: {
        minHealth: 20,
        objects: {
          "kelp-wrack": 1
        },
        hint: "Gulls show up as soon as there's a beach worth patrolling."
      },
      scientificName: "Larus occidentalis",
      role: "A bold generalist that scavenges carrion and preys on crabs, shellfish, and even sea stars, cleaning the beach and linking many prey to the top of the food web. Foxes and coyotes take gulls and their eggs on land.",
      trophic: "omnivore",
      eats: [
        "clam",
        "hermit-crab",
        "mussel",
        "purple-shore-crab",
        "sea-star",
        "tidepool-crab"
      ],
      eatsOther: [
        "clams",
        "fish",
        "mussels"
      ],
      sources: [
        {
          name: "All About Birds - Western Gull Life History",
          url: "https://www.allaboutbirds.org/guide/Western_Gull/lifehistory"
        }
      ]
    },
    {
      id: "pelican",
      name: "Brown Pelican",
      biome: "coastal",
      kind: "bird",
      rarity: "uncommon",
      diet: "Small schooling fish, especially anchovies",
      shelter: "Quiet roosts on rocks and sandbars",
      preferredHabitat: "Fish-rich nearshore water with quiet roosts",
      fact: "Brown pelicans plunge-dive from up to 65 feet, twisting to protect the neck on impact.",
      requirements: {
        minHealth: 55,
        objects: {
          "coastal-nesting-area": 1,
          tidepool: 1,
          "dune-grass": 1
        },
        hint: "Quiet roosting space and fishable water."
      },
      scientificName: "Pelecanus occidentalis",
      role: "A plunge-diving fish specialist whose recovery after DDT is a major conservation success. Its presence signals healthy schools of forage fish like anchovies in nearshore water.",
      trophic: "apex-predator",
      eatsOther: [
        "fish"
      ],
      sources: [
        {
          name: "All About Birds - Brown Pelican Life History",
          url: "https://www.allaboutbirds.org/guide/Brown_Pelican/lifehistory"
        }
      ]
    },
    {
      id: "cormorant",
      name: "Pelagic Cormorant",
      biome: "coastal",
      kind: "bird",
      rarity: "uncommon",
      diet: "Small fish, plus crabs and shrimp chased underwater",
      shelter: "Cliff and rock roosts",
      preferredHabitat: "Rocky shore with clear diving water",
      fact: "Cormorant feathers soak through on purpose, so less buoyancy makes them better divers.",
      requirements: {
        minHealth: 55,
        objects: {
          tidepool: 2,
          "dune-grass": 1
        },
        hint: "Healthy rocky shallows to dive in."
      },
      scientificName: "Urile pelagicus",
      role: "A pursuit-diving fish hunter that works rocky reefs and the water column. It depends on clear water and healthy fish stocks, so thriving cormorants signal a productive rocky shore.",
      trophic: "apex-predator",
      eatsOther: [
        "fish"
      ],
      sources: [
        {
          name: "All About Birds - Pelagic Cormorant Life History",
          url: "https://www.allaboutbirds.org/guide/Pelagic_Cormorant/lifehistory"
        }
      ]
    },
    {
      id: "sea-turtle",
      name: "Green Sea Turtle",
      biome: "coastal",
      kind: "reptile",
      rarity: "rare",
      diet: "Mostly seagrass and algae as adults; omnivorous when young",
      shelter: "Offshore waters; nests on quiet sand",
      preferredHabitat: "Clean shallow water with seagrass and undisturbed beach",
      fact: "Green sea turtles return to nest on the very beach where they hatched decades earlier.",
      requirements: {
        minHealth: 75,
        objects: {
          "coastal-nesting-area": 1,
          "dune-grass": 2,
          "kelp-wrack": 1
        },
        hint: "An undisturbed nesting beach and clean water."
      },
      scientificName: "Chelonia mydas",
      role: "The only mostly herbivorous sea turtle; adults graze seagrass and algae, keeping beds healthy, while juveniles start as omnivores. Its nesting success is a strong indicator of clean water and undisturbed beaches.",
      trophic: "herbivore",
      eatsOther: [
        "algae",
        "seagrass"
      ],
      sources: [
        {
          name: "NOAA Fisheries - Green Turtle",
          url: "https://www.fisheries.noaa.gov/species/green-turtle"
        },
        {
          name: "Animal Diversity Web - Chelonia mydas",
          url: "https://animaldiversity.org/accounts/Chelonia_mydas/"
        }
      ],
      ocean: true
    },
    {
      id: "harbor-seal",
      name: "Harbor Seal",
      biome: "coastal",
      kind: "mammal",
      rarity: "rare",
      featured: true,
      diet: "Fish, plus squid, octopus, and crustaceans",
      shelter: "Quiet haul-out beaches and rocks",
      preferredHabitat: "Calm, clean water with undisturbed haul-out shore",
      fact: "Harbor seals can sleep underwater, surfacing to breathe without fully waking.",
      requirements: {
        minHealth: 70,
        objects: {
          "coastal-nesting-area": 1,
          tidepool: 1,
          "dune-grass": 1
        },
        hint: "Quiet beaches and clean water \u2014 seals need calm above all."
      },
      scientificName: "Phoca vitulina",
      role: "A generalist marine predator that eats whatever fish is abundant and easy to catch. Sharks and killer whales are its main predators offshore, but on this restored coast it sits near the top of the food web.",
      trophic: "apex-predator",
      eatsOther: [
        "fish"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Phoca vitulina",
          url: "https://animaldiversity.org/accounts/Phoca_vitulina/"
        },
        {
          name: "NOAA Fisheries - Harbor Seal",
          url: "https://www.fisheries.noaa.gov/species/harbor-seal"
        }
      ],
      ocean: true
    },
    {
      id: "sea-otter",
      name: "Sea Otter",
      biome: "coastal",
      kind: "mammal",
      rarity: "rare",
      diet: "Sea urchins, crabs, mussels, clams, and other shellfish",
      shelter: "Kelp canopy anchor points",
      preferredHabitat: "Kelp forest and rocky shore with abundant shellfish",
      fact: "Sea otters wrap up in kelp before sleeping so they don't drift away.",
      requirements: {
        minHealth: 75,
        minBalance: 45,
        objects: {
          "kelp-wrack": 2,
          tidepool: 1,
          "dune-grass": 1
        },
        animals: [
          "mussel",
          "clam"
        ],
        hint: "Kelp habitat and shellfish beds first; otters follow."
      },
      scientificName: "Enhydra lutris",
      role: "A keystone species: by eating sea urchins it stops them overgrazing kelp, letting kelp forests and the life they shelter thrive. It also preys heavily on mussels and clams along the rocky shore.",
      trophic: "apex-predator",
      eats: [
        "clam",
        "mussel",
        "sea-star"
      ],
      eatsOther: [
        "clams",
        "crabs",
        "sea urchins"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Enhydra lutris",
          url: "https://animaldiversity.org/accounts/Enhydra_lutris/"
        },
        {
          name: "Monterey Bay Aquarium - Sea otter",
          url: "https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/sea-otter"
        }
      ],
      ocean: true
    },
    {
      id: "dolphin",
      name: "Bottlenose Dolphin",
      biome: "coastal",
      kind: "mammal",
      rarity: "rare",
      diet: "Fish, squid, and crustaceans",
      shelter: "Open coastal water",
      preferredHabitat: "Clean, lively nearshore water",
      fact: "Bottlenose dolphins call each other by name, using signature whistles unique to each one.",
      requirements: {
        minHealth: 75,
        objects: {
          tidepool: 2,
          "kelp-wrack": 1,
          "dune-grass": 1
        },
        hint: "A clean, busy shoreline brings dolphins close in."
      },
      scientificName: "Tursiops truncatus",
      role: "A clever, cooperative predator that herds fish and hunts squid in nearshore water. Larger sharks and orcas can prey on it, but in this roster it is a top predator whose presence marks a lively, fish-rich coast.",
      trophic: "apex-predator",
      eatsOther: [
        "fish"
      ],
      sources: [
        {
          name: "NOAA Fisheries - Common Bottlenose Dolphin",
          url: "https://www.fisheries.noaa.gov/species/common-bottlenose-dolphin"
        }
      ],
      ocean: true
    },
    {
      id: "migrating-whale",
      name: "Gray Whale",
      biome: "coastal",
      kind: "mammal",
      rarity: "rare",
      diet: "Amphipods and other tiny bottom crustaceans, sifted from sediment",
      shelter: "Open ocean; passes close to healthy shores",
      preferredHabitat: "Seen offshore from a fully restored coast",
      fact: "Gray whales migrate up to 14,000 miles round trip, among the longest of any mammal.",
      requirements: {
        minHealth: 75,
        minBalance: 50,
        objects: {
          tidepool: 2,
          "dune-grass": 2,
          "coastal-nesting-area": 1
        },
        hint: "Only a truly thriving shore earns a whale sighting. Watch the horizon.",
        conditions: {
          season: [
            "winter",
            "spring"
          ]
        }
      },
      scientificName: "Eschrichtius robustus",
      role: "A bottom-feeding baleen whale that rolls on its side to suck up sediment and filter out tiny crustaceans. Killer whales are its main predator; a passing gray whale is a sign of a fully restored, productive coast.",
      trophic: "filter-feeder",
      eatsOther: [
        "plankton"
      ],
      sources: [
        {
          name: "NOAA Fisheries - Gray Whale",
          url: "https://www.fisheries.noaa.gov/species/gray-whale"
        },
        {
          name: "Animal Diversity Web - Eschrichtius robustus",
          url: "https://animaldiversity.org/accounts/Eschrichtius_robustus/"
        }
      ],
      ocean: true
    },
    {
      id: "american-goldfinch",
      name: "American Goldfinch",
      biome: "meadow",
      kind: "bird",
      rarity: "common",
      featured: false,
      diet: "Almost entirely seeds \u2014 thistle, sunflower, aster, and grass seeds",
      shelter: "Tightly woven cup nest lashed high in a shrub with spider silk",
      preferredHabitat: "Weedy fields and open areas with thistle, sunflower, and asters",
      fact: "Goldfinches are strict vegetarians and nest late in summer so thistle down is ready to line their nests.",
      requirements: {
        minHealth: 45,
        objects: {
          "wildflower-patch": 1,
          "bird-perch": 1,
          shrub: 1
        },
        hint: "Plant a wildflower patch and add a bird perch."
      },
      scientificName: "Spinus tristis",
      role: "A specialist granivore that thrives on thistle and other composite seeds, making it an important disperser of weedy plant seeds across the meadow. Being small and abundant, it is prey for agile bird-hunting hawks and small owls.",
      trophic: "herbivore",
      eatenBy: [
        "coopers-hawk",
        "western-screech-owl"
      ],
      eatsOther: [
        "aster seeds",
        "grass seeds",
        "sunflower seeds",
        "thistle seeds"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds \u2014 American Goldfinch Life History",
          url: "https://www.allaboutbirds.org/guide/American_Goldfinch/lifehistory"
        },
        {
          name: "Audubon Field Guide \u2014 American Goldfinch",
          url: "https://www.audubon.org/field-guide/bird/american-goldfinch"
        }
      ]
    },
    {
      id: "eastern-bluebird",
      name: "Eastern Bluebird",
      biome: "meadow",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Mainly ground insects (caterpillars, beetles, grasshoppers); fruit in winter",
      shelter: "Grass-lined nest inside tree cavities, old woodpecker holes, or boxes",
      preferredHabitat: "Grassy openings with scattered trees and perches to hunt from",
      fact: "Eastern Bluebirds can spot a tiny insect in the grass from about 60 feet away, then drop down to grab it.",
      requirements: {
        minHealth: 55,
        objects: {
          "bird-perch": 1,
          "native-grass-patch": 1,
          "berry-bush": 1
        },
        hint: "Native grass, a berry bush, and a perch to hunt from."
      },
      scientificName: "Sialia sialis",
      role: "A cavity-nesting insectivore that hunts caterpillars, beetles, and grasshoppers from perches, switching to berries in winter, both controlling insects and dispersing fruit seeds. It competes for nest holes and is preyed on by hawks and small owls.",
      trophic: "insectivore",
      eats: [
        "bumblebee",
        "grasshopper",
        "lady-beetle",
        "praying-mantis"
      ],
      eatenBy: [
        "coopers-hawk",
        "red-tailed-hawk",
        "western-screech-owl"
      ],
      eatsOther: [
        "beetles",
        "berries",
        "caterpillars",
        "crickets",
        "spiders"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds \u2014 Eastern Bluebird Life History",
          url: "https://www.allaboutbirds.org/guide/Eastern_Bluebird/lifehistory"
        },
        {
          name: "Audubon Field Guide \u2014 Eastern Bluebird",
          url: "https://www.audubon.org/field-guide/bird/eastern-bluebird"
        }
      ]
    },
    {
      id: "leafcutter-bee",
      name: "Leafcutter Bee",
      biome: "meadow",
      kind: "insect",
      rarity: "common",
      featured: false,
      diet: "Adults eat nectar and pollen from many flowering plants",
      shelter: "Nests in hollow stems and soil, lining cells with cut leaf pieces",
      preferredHabitat: "Meadows and gardens with diverse flowers and nesting cavities",
      fact: "Female leafcutter bees snip neat circles from leaves to build and seal their nest cells.",
      requirements: {
        minHealth: 40,
        objects: {
          "clover-patch": 1,
          "wildflower-patch": 1,
          shrub: 1
        },
        hint: "Clover and wildflowers side by side."
      },
      scientificName: "Megachile spp.",
      role: "A solitary native bee that pollinates a wide range of meadow and crop plants, carrying pollen on the underside of its abdomen. Its leaf-lined nest cells provision the next generation with pollen and nectar. Adults are caught by ambush predators and aerial insectivores.",
      trophic: "herbivore",
      eatenBy: [
        "barn-swallow",
        "praying-mantis"
      ],
      eatsOther: [
        "flower nectar",
        "pollen"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Megachile rotundata",
          url: "https://animaldiversity.org/accounts/Megachile_rotundata/"
        },
        {
          name: "USDA Forest Service \u2014 Leafcutter Bees (Megachile spp.)",
          url: "https://www.fs.usda.gov/wildflowers/pollinators/pollinator-of-the-month/megachile_bees.shtml"
        }
      ]
    },
    {
      id: "painted-lady",
      name: "Painted Lady",
      biome: "meadow",
      kind: "insect",
      rarity: "common",
      featured: false,
      diet: "Adults nectar on composite flowers; caterpillars eat thistles and mallows",
      shelter: "Rests on vegetation; caterpillars build silk nests on host plants",
      preferredHabitat: "Open meadows and disturbed ground with thistles and nectar flowers",
      fact: "Painted ladies migrate thousands of miles across continents \u2014 one of the most widespread butterflies on Earth.",
      requirements: {
        minHealth: 40,
        objects: {
          "butterfly-flowers": 1,
          "clover-patch": 1,
          shrub: 1
        },
        hint: "Butterfly flowers near a clover patch."
      },
      scientificName: "Vanessa cardui",
      role: "A wide-ranging migratory butterfly and generalist nectar pollinator whose caterpillars feed on thistles, mallows, and over 100 other host plants. Population booms can trigger massive migrations. Adults and larvae are eaten by birds, wasps, and spiders.",
      trophic: "herbivore",
      eatenBy: [
        "barn-swallow",
        "praying-mantis"
      ],
      eatsOther: [
        "flower nectar (adult)",
        "mallows (caterpillar)",
        "thistles (caterpillar)"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Vanessa cardui",
          url: "https://animaldiversity.org/accounts/Vanessa_cardui/"
        },
        {
          name: "Butterflies and Moths of North America \u2014 Painted Lady",
          url: "https://www.butterfliesandmoths.org/species/Vanessa-cardui"
        }
      ]
    },
    {
      id: "american-badger",
      name: "American Badger",
      biome: "meadow",
      kind: "mammal",
      rarity: "rare",
      featured: false,
      diet: "Digs out ground squirrels, gophers, voles, and mice; also insects",
      shelter: "Digs its own large underground burrows; a powerful excavator",
      preferredHabitat: "Open meadows and grasslands with diggable soil and rodent prey",
      fact: "Badgers sometimes team up with coyotes: the badger digs prey out below while the coyote catches those that bolt above ground.",
      requirements: {
        minHealth: 65,
        objects: {
          "brush-pile": 1,
          "rock-pile": 1,
          shrub: 1
        },
        animals: [
          "meadow-vole"
        ],
        hint: "Brush pile and rock pile, once voles have returned."
      },
      scientificName: "Taxidea taxus",
      role: "A fossorial carnivore that hunts by digging burrowing rodents straight out of their tunnels, keeping ground squirrel and vole numbers down. Its abandoned burrows benefit other animals. Adult badgers have essentially no predators in this meadow.",
      trophic: "mesopredator",
      eats: [
        "cottontail-rabbit",
        "ground-squirrel",
        "meadow-vole",
        "western-meadowlark"
      ],
      eatsOther: [
        "carrion",
        "ground-nesting bird eggs",
        "insects",
        "mice",
        "pocket gophers"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Taxidea taxus",
          url: "https://animaldiversity.org/accounts/Taxidea_taxus/"
        },
        {
          name: "NHPBS NatureWorks \u2014 American Badger",
          url: "https://nhpbs.org/natureworks/americanbadger.htm"
        }
      ]
    },
    {
      id: "pileated-woodpecker",
      name: "Pileated Woodpecker",
      biome: "forest",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Carpenter ants and wood-boring beetle larvae; also termites, berries, and nuts",
      shelter: "Excavates a new rectangular nest cavity each year in large dead snags",
      preferredHabitat: "Mature and old-growth forest with big standing snags and downed logs",
      fact: "Its deep rectangular excavations can be large enough to snap a small tree in half.",
      requirements: {
        minHealth: 55,
        objects: {
          "standing-deadwood": 1,
          "nesting-tree": 1,
          shrub: 1
        },
        hint: "Standing deadwood beside a nesting tree."
      },
      scientificName: "Dryocopus pileatus",
      role: "The pileated woodpecker is a keystone ecosystem engineer whose big cavities become homes for wood ducks, flying squirrels, fishers, bats, and barred owls. It regulates carpenter ant and beetle populations and opens decaying wood to fungi and decomposers. It sits as a secondary consumer and feeds raptors and mustelids.",
      trophic: "insectivore",
      eats: [
        "nuthatch"
      ],
      eatenBy: [
        "barred-owl",
        "bobcat",
        "fisher",
        "great-horned-owl",
        "raccoon",
        "red-fox-forest"
      ],
      eatsOther: [
        "acorns",
        "beetle larvae",
        "berries",
        "carpenter ants",
        "nuts",
        "termites"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds \u2014 Pileated Woodpecker",
          url: "https://www.allaboutbirds.org/guide/Pileated_Woodpecker/lifehistory"
        },
        {
          name: "Animal Diversity Web \u2014 Dryocopus pileatus",
          url: "https://animaldiversity.org/accounts/Dryocopus_pileatus/"
        }
      ]
    },
    {
      id: "pacific-wren",
      name: "Pacific Wren",
      biome: "forest",
      kind: "bird",
      rarity: "common",
      featured: false,
      diet: "Beetles, caterpillars, ants, flies, spiders, and millipedes; some winter berries",
      shelter: "Domed nests low in upturned roots, decaying logs, and stream banks",
      preferredHabitat: "Old-growth conifer forest with dense understory near streams",
      fact: "Pacific wren numbers along streams rise with salmon runs, whose nutrients boost the insects the wrens eat.",
      requirements: {
        minHealth: 50,
        objects: {
          "fern-grove": 1,
          "mushroom-log": 1,
          shrub: 1
        },
        hint: "Ferns and a mushroom log in the shade."
      },
      scientificName: "Troglodytes pacificus",
      role: "The Pacific wren is a secondary consumer that suppresses understory invertebrates in old-growth forest, passing that energy up to hawks, corvids, and weasels. Its dependence on damp, log-strewn old growth and salmon-fed streams makes it a living indicator of both forest and watershed health. It nests low in root tangles and rotting wood.",
      trophic: "insectivore",
      eatenBy: [
        "barred-owl",
        "garter-snake-forest",
        "great-horned-owl",
        "raccoon"
      ],
      eatsOther: [
        "ants",
        "beetles",
        "berries",
        "caterpillars",
        "millipedes",
        "snails",
        "spiders"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds \u2014 Pacific Wren",
          url: "https://www.allaboutbirds.org/guide/Pacific_Wren/lifehistory"
        },
        {
          name: "Audubon \u2014 Pacific Wren",
          url: "https://www.audubon.org/field-guide/bird/pacific-wren"
        }
      ]
    },
    {
      id: "rough-skinned-newt",
      name: "Rough-skinned Newt",
      biome: "forest",
      kind: "amphibian",
      rarity: "uncommon",
      featured: false,
      diet: "Insects, earthworms, slugs, snails, and amphibian and fish eggs",
      shelter: "Under rotting logs, rocks, and leaf litter; in ponds during breeding season",
      preferredHabitat: "Pacific conifer forest near still or slow water",
      fact: "Its skin holds enough tetrodotoxin to kill several adults, driving a famous poison arms race with garter snakes.",
      requirements: {
        minHealth: 55,
        objects: {
          "mushroom-log": 1,
          shrub: 1
        },
        water: {
          tiles: 3
        },
        hint: "A mushroom log and a few flooded water tiles."
      },
      scientificName: "Taricha granulosa",
      role: "The rough-skinned newt is a mid-trophic consumer of insects, worms, and amphibian eggs, shaping wetland invertebrate and amphibian communities. Its potent tetrodotoxin defense drives adaptive evolution in resistant garter snakes, one of biology's best-known coevolutionary arms races. The toxin leaves it nearly free from most other predators.",
      trophic: "insectivore",
      eatenBy: [
        "barred-owl",
        "garter-snake-forest",
        "raccoon"
      ],
      eatsOther: [
        "amphibian eggs",
        "earthworms",
        "fish eggs",
        "insects",
        "slugs",
        "snails"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Taricha granulosa",
          url: "https://animaldiversity.org/accounts/Taricha_granulosa/"
        },
        {
          name: "USGS \u2014 Barred Owl predation on Taricha granulosa",
          url: "https://www.usgs.gov/publications/taricha-granulosa-rough-skinned-newt-predation"
        }
      ]
    },
    {
      id: "northern-flying-squirrel",
      name: "Northern Flying Squirrel",
      biome: "forest",
      kind: "mammal",
      rarity: "rare",
      featured: false,
      diet: "Mostly underground truffle fungi; also lichens, seeds, nuts, fruit, and insects",
      shelter: "Tree cavities, old woodpecker holes, and branch dreys; huddles in winter groups",
      preferredHabitat: "Closed-canopy mature conifer forest rich in mycorrhizal fungi",
      fact: "Fungal spores turn up in nearly every flying squirrel dropping, making it the forest's key truffle disperser.",
      requirements: {
        minHealth: 65,
        objects: {
          "nesting-tree": 1,
          "tree-stump": 1,
          shrub: 1
        },
        animals: [
          "tree-squirrel"
        ],
        hint: "Nesting tree and a stump, once tree squirrels are back."
      },
      scientificName: "Glaucomys sabrinus",
      role: "The northern flying squirrel is a keystone mutualist, the main disperser of underground mycorrhizal fungi that conifers depend on for nutrients. This squirrel-fungi-tree partnership underpins forest regeneration. It is also a prime prey item for owls, martens, and fishers, funneling energy from the fungal layer up to top predators.",
      trophic: "omnivore",
      eatenBy: [
        "barred-owl",
        "bobcat",
        "fisher",
        "great-horned-owl",
        "raccoon",
        "red-fox-forest"
      ],
      eatsOther: [
        "acorns",
        "fungi",
        "insects",
        "lichens",
        "nuts",
        "seeds",
        "truffles"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Glaucomys sabrinus",
          url: "https://animaldiversity.org/accounts/Glaucomys_sabrinus/"
        },
        {
          name: "USDA Forest Service \u2014 Meyer et al. 2005 (truffle spore dispersal)",
          url: "https://www.fs.usda.gov/psw/publications/meyer/captured/psw_2005_meyer003.pdf"
        }
      ]
    },
    {
      id: "wood-duck",
      name: "Wood Duck",
      biome: "forest",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Acorns, seeds, and aquatic plants; ducklings and spring birds also eat insects and snails",
      shelter: "Obligate cavity nester in tree holes and nest boxes near water",
      preferredHabitat: "Bottomland hardwood and wooded swamps with slow water and cavity trees",
      fact: "A day after hatching, wood duck ducklings leap from nest cavities up to 50 feet high and land unhurt.",
      requirements: {
        minHealth: 60,
        objects: {
          "nesting-tree": 1,
          shrub: 1
        },
        water: {
          lake: 4
        },
        hint: "A nesting tree beside a flooded pool of 4+ water tiles."
      },
      scientificName: "Aix sponsa",
      role: "Wood ducks are omnivorous consumers linking bottomland forest and wetland food webs, dispersing acorn and aquatic-plant seeds and regulating shallow-water invertebrates. As prey they feed great horned owls, mink, raccoons, and snapping turtles. Depending on woodpecker cavities, their abundance signals healthy wooded wetlands.",
      trophic: "omnivore",
      eatenBy: [
        "barred-owl",
        "fisher",
        "garter-snake-forest",
        "great-horned-owl",
        "raccoon",
        "red-fox-forest"
      ],
      eatsOther: [
        "acorns",
        "aquatic plants",
        "duckweed",
        "insects",
        "nuts",
        "seeds",
        "snails"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds \u2014 Wood Duck",
          url: "https://www.allaboutbirds.org/guide/Wood_Duck/lifehistory"
        },
        {
          name: "Animal Diversity Web \u2014 Aix sponsa",
          url: "https://animaldiversity.org/accounts/Aix_sponsa/"
        }
      ]
    },
    {
      id: "american-bittern",
      name: "American Bittern",
      biome: "wetland",
      kind: "bird",
      rarity: "rare",
      featured: false,
      diet: "Fish, frogs, insects, crayfish, snakes, and small mammals",
      shelter: "Platform nests hidden low in dense reeds",
      preferredHabitat: "Tall marsh vegetation over shallow water",
      fact: "The bittern freezes bill-skyward, swaying like a reed to vanish in the marsh.",
      requirements: {
        minHealth: 60,
        objects: {
          "reed-bed": 2,
          "cattail-stand": 1,
          "sedge-tussock": 1
        },
        water: {
          tiles: 4
        },
        hint: "Thick reeds and cattails beside open water.",
        conditions: {
          dayPhase: [
            "dawn",
            "dusk"
          ]
        }
      },
      scientificName: "Botaurus lentiginosus",
      role: "A secretive ambush predator of the reed beds. It stands motionless, then seizes fish, frogs, and insects, relying on stripy camouflage to stay hidden.",
      trophic: "mesopredator",
      eats: [
        "chorus-frog",
        "freshwater-fish",
        "northern-leopard-frog"
      ],
      eatsOther: [
        "crayfish",
        "insects"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds - American Bittern",
          url: "https://www.allaboutbirds.org/guide/American_Bittern/lifehistory"
        }
      ]
    },
    {
      id: "belted-kingfisher",
      name: "Belted Kingfisher",
      biome: "wetland",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Small fish and crayfish, plus other aquatic prey",
      shelter: "Tunnel burrows dug into earthen banks",
      preferredHabitat: "Clear water with perches over fishable shallows",
      fact: "Kingfishers dive headfirst into the water with their eyes closed to grab fish.",
      requirements: {
        minHealth: 65,
        objects: {
          "nesting-platform": 1,
          "reed-bed": 1
        },
        water: {
          river: 4
        },
        animals: [
          "freshwater-fish"
        ],
        hint: "Carve a river 4+ tiles long with fish present, plus a platform."
      },
      scientificName: "Megaceryle alcyon",
      role: "A plunge-diving fish specialist that watches from a perch and dives on small fish and crayfish. It nests in tunnels dug metres into stream banks.",
      trophic: "mesopredator",
      eats: [
        "freshwater-fish"
      ],
      eatsOther: [
        "crayfish",
        "fish"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds - Belted Kingfisher",
          url: "https://www.allaboutbirds.org/guide/Belted_Kingfisher/lifehistory"
        }
      ]
    },
    {
      id: "northern-leopard-frog",
      name: "Northern Leopard Frog",
      biome: "wetland",
      kind: "amphibian",
      rarity: "common",
      featured: false,
      diet: "Insects, spiders, worms, and other small animals",
      shelter: "Shallow water and grassy margins",
      preferredHabitat: "Lily-fringed shallows",
      fact: "Leopard frogs escape with erratic zig-zag leaps straight back into the water.",
      requirements: {
        minHealth: 50,
        objects: {
          "lily-pool": 1,
          "reed-bed": 1
        },
        water: {
          tiles: 3
        },
        hint: "A lily pool and a few open-water tiles."
      },
      scientificName: "Lithobates pipiens",
      role: "A wide-mouthed generalist that eats almost any small animal it can swallow, from insects to smaller frogs. It is key prey for herons, mink, and snakes.",
      trophic: "insectivore",
      eats: [
        "damselfly",
        "dragonfly",
        "water-strider"
      ],
      eatenBy: [
        "american-bittern",
        "great-blue-heron",
        "green-heron",
        "mink",
        "river-otter"
      ],
      eatsOther: [
        "insects",
        "worms"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Lithobates pipiens",
          url: "https://animaldiversity.org/accounts/Lithobates_pipiens/"
        },
        {
          name: "U.S. National Park Service - Northern Leopard Frog",
          url: "https://www.nps.gov/articles/northern-leopard-frog.htm"
        }
      ]
    },
    {
      id: "snapping-turtle",
      name: "Snapping Turtle",
      biome: "wetland",
      kind: "reptile",
      rarity: "uncommon",
      featured: false,
      diet: "Fish, aquatic plants, carrion, and almost anything it can catch",
      shelter: "Muddy lake and pond bottoms",
      preferredHabitat: "Deep still water with a soft mud bottom",
      fact: "Adult snapping turtles have almost no natural predators and can live for decades.",
      requirements: {
        minHealth: 60,
        objects: {
          "mud-bank": 1,
          "reed-bed": 1
        },
        water: {
          lake: 5
        },
        hint: "A mud bank beside a lake of 5+ connected water tiles."
      },
      scientificName: "Chelydra serpentina",
      role: "A heavily armored omnivore and scavenger lurking on the pond bottom. As an adult it sits near the top of the wetland food web, eating fish, ducklings, plants, and carrion.",
      trophic: "omnivore",
      eats: [
        "freshwater-fish",
        "mallard-duck"
      ],
      eatsOther: [
        "aquatic plants",
        "detritus",
        "fish"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Chelydra serpentina",
          url: "https://animaldiversity.org/accounts/Chelydra_serpentina/"
        }
      ]
    },
    {
      id: "marsh-wren",
      name: "Marsh Wren",
      biome: "wetland",
      kind: "bird",
      rarity: "common",
      featured: false,
      diet: "Insects and spiders picked from marsh vegetation",
      shelter: "Woven dome nests among cattails and bulrushes",
      preferredHabitat: "Cattail and sedge stands",
      fact: "Males build many dummy nests and even destroy neighbours' eggs.",
      requirements: {
        minHealth: 50,
        objects: {
          "reed-bed": 2,
          "sedge-tussock": 1,
          "shallow-water-pool": 1
        },
        hint: "Two reed beds and a sedge tussock."
      },
      scientificName: "Cistothorus palustris",
      role: "A tiny, feisty insectivore of the reeds. It gleans insects and spiders from stems and famously builds several decoy nests to court a mate.",
      trophic: "insectivore",
      eatsOther: [
        "insects"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds - Marsh Wren",
          url: "https://www.allaboutbirds.org/guide/Marsh_Wren/lifehistory"
        }
      ]
    },
    {
      id: "gila-woodpecker",
      name: "Gila Woodpecker",
      biome: "desert",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Insects, cactus fruit, and berries",
      shelter: "Cavities excavated in saguaro cactus",
      preferredHabitat: "Saguaro and cactus stands",
      fact: "Its abandoned saguaro cavities later shelter elf owls, pygmy-owls, and kestrels.",
      requirements: {
        minHealth: 50,
        objects: {
          "cactus-patch": 2,
          "desert-brush": 1
        },
        hint: "Two cactus patches for nesting cavities."
      },
      scientificName: "Melanerpes uropygialis",
      role: "A cactus-nesting woodpecker and desert keystone builder. It eats insects, cactus fruit, and berries, and its old nest holes house many other desert animals. Hawks, snakes, and bobcats prey on it.",
      trophic: "omnivore",
      eatenBy: [
        "rattlesnake"
      ],
      eatsOther: [
        "berries",
        "cactus fruit",
        "insects"
      ],
      sources: [
        {
          name: "Arizona-Sonora Desert Museum \u2014 Gila Woodpecker",
          url: "https://www.desertmuseum.org/kids/oz/long-fact-sheets/Gila%20Woodpecker.php"
        },
        {
          name: "Cornell Lab All About Birds \u2014 Gila Woodpecker",
          url: "https://www.allaboutbirds.org/guide/Gila_Woodpecker/overview"
        }
      ]
    },
    {
      id: "cactus-wren",
      name: "Cactus Wren",
      biome: "desert",
      kind: "bird",
      rarity: "common",
      featured: false,
      diet: "Spiders, insects, and some fruit",
      shelter: "Thorny cactus and brush",
      preferredHabitat: "Open desert with cactus",
      fact: "Cactus wrens use their football-shaped cholla nests year-round, even sleeping in them.",
      requirements: {
        minHealth: 45,
        objects: {
          "cactus-patch": 1,
          "desert-brush": 1,
          "rock-pile": 1
        },
        hint: "A cactus patch and desert brush."
      },
      scientificName: "Campylorhynchus brunneicapillus",
      role: "The largest North American wren, an insectivore gleaning spiders and insects and taking cactus fruit. It gets most of its water from food. Snakes, roadrunners, and hawks prey on it and its nests.",
      trophic: "insectivore",
      eats: [
        "desert-bee"
      ],
      eatenBy: [
        "rattlesnake",
        "roadrunner"
      ],
      eatsOther: [
        "cactus fruit",
        "insects"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds \u2014 Cactus Wren",
          url: "https://www.allaboutbirds.org/guide/Cactus_Wren/lifehistory"
        }
      ]
    },
    {
      id: "desert-iguana",
      name: "Desert Iguana",
      biome: "desert",
      kind: "reptile",
      rarity: "uncommon",
      featured: false,
      diet: "Flowers, buds, and leaves, especially creosote",
      shelter: "Burrows under shrubs",
      preferredHabitat: "Hot sandy flats with cover",
      fact: "Desert iguanas stay active near 40C, heat that drives other lizards into the shade.",
      requirements: {
        minHealth: 50,
        objects: {
          "agave-rosette": 1,
          "rock-pile": 1,
          "desert-brush": 1
        },
        hint: "An agave rosette and a rock pile."
      },
      scientificName: "Dipsosaurus dorsalis",
      role: "A heat-loving herbivorous lizard that feeds mainly on creosote bush flowers and leaves. It is a desert plant grazer and prey for snakes, raptors, and foxes. It shelters in burrows through the hottest hours.",
      trophic: "herbivore",
      eatenBy: [
        "kit-fox",
        "rattlesnake"
      ],
      eatsOther: [
        "flowers",
        "leaves"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Dipsosaurus dorsalis",
          url: "https://animaldiversity.org/accounts/Dipsosaurus_dorsalis/"
        }
      ]
    },
    {
      id: "kangaroo-mouse",
      name: "Kangaroo Mouse",
      biome: "desert",
      kind: "mammal",
      rarity: "uncommon",
      featured: false,
      diet: "Seeds, plus insects in summer",
      shelter: "Sand burrows plugged by day",
      preferredHabitat: "Fine sandy desert",
      fact: "It survives on water made from its food and may go a lifetime without ever drinking.",
      requirements: {
        minHealth: 50,
        objects: {
          "burrow-mound": 1,
          "desert-brush": 1,
          "cactus-patch": 1
        },
        hint: "A burrow mound near desert brush."
      },
      scientificName: "Microdipodops pallidus",
      role: "A tiny seed-eating rodent that stores fat in its tail for lean times. It is prey for rattlesnakes, owls, and foxes, making it part of the base of the desert food web. It rarely if ever needs to drink.",
      trophic: "herbivore",
      eatenBy: [
        "burrowing-owl",
        "kit-fox",
        "rattlesnake"
      ],
      eatsOther: [
        "insects",
        "seeds"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Microdipodops pallidus",
          url: "https://animaldiversity.org/accounts/Microdipodops_pallidus/"
        }
      ]
    },
    {
      id: "banded-gecko",
      name: "Western Banded Gecko",
      biome: "desert",
      kind: "reptile",
      rarity: "common",
      featured: false,
      diet: "Insects, spiders, and small scorpions",
      shelter: "Rock crevices",
      preferredHabitat: "Sheltered rocky desert",
      fact: "Unlike most geckos, the banded gecko has movable eyelids and squeaks when captured.",
      requirements: {
        minHealth: 45,
        objects: {
          ocotillo: 1,
          "shaded-rock-shelter": 1,
          "desert-brush": 1
        },
        hint: "Ocotillo beside a shaded rock shelter."
      },
      scientificName: "Coleonyx variegatus",
      role: "A small nocturnal gecko that hunts insects, spiders, and even young scorpions. It is a mesopredator on tiny desert prey and food for larger lizards, snakes, and roadrunners. It sheds its tail to escape.",
      trophic: "insectivore",
      eats: [
        "desert-bee",
        "scorpion"
      ],
      eatenBy: [
        "collared-lizard",
        "rattlesnake",
        "roadrunner"
      ],
      eatsOther: [
        "insects"
      ],
      sources: [
        {
          name: "Arizona-Sonora Desert Museum \u2014 Western Banded Gecko",
          url: "https://www.desertmuseum.org/books/nhsd_banded_gecko.php"
        }
      ]
    },
    {
      id: "rosy-finch",
      name: "Gray-crowned Rosy-Finch",
      biome: "alpine",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Tiny alpine plant seeds and insects, often gleaned off snowfields",
      shelter: "Bulky cup of moss and grass tucked into a cliff crack or talus",
      preferredHabitat: "Alpine zones above treeline: talus, scree, cliffs, and glaciers",
      fact: "It nests higher than nearly any other songbird in North America.",
      requirements: {
        minHealth: 50,
        objects: {
          "alpine-wildflower-patch": 1,
          "rock-pile": 1,
          "heather-mat": 1
        },
        hint: "Alpine wildflowers and a rock pile."
      },
      scientificName: "Leucosticte tephrocotis",
      role: "A high-altitude songbird that hops across snow and talus gathering wind-borne seeds and chilled insects. It nests in rock crevices above treeline. Falcons and hawks are its main predators.",
      trophic: "omnivore",
      eatsOther: [
        "alpine plants",
        "insects",
        "seeds"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds - Gray-crowned Rosy-Finch",
          url: "https://www.allaboutbirds.org/guide/Gray-crowned_Rosy-Finch/lifehistory"
        },
        {
          name: "USFWS - Gray-crowned Rosy-Finch",
          url: "https://www.fws.gov/species/grey-crowned-rosy-finch-leucosticte-tephrocotis"
        }
      ]
    },
    {
      id: "american-pipit",
      name: "American Pipit",
      biome: "alpine",
      kind: "bird",
      rarity: "common",
      featured: false,
      diet: "Mostly insects and their larvae, plus spiders and some seeds",
      shelter: "Ground nest of grass tucked beside a rock or vegetation clump",
      preferredHabitat: "Open alpine meadows and tundra in the breeding season",
      fact: "It forages at snowbank edges for insects chilled after drifting up from below.",
      requirements: {
        minHealth: 50,
        objects: {
          "heather-mat": 1,
          "alpine-wildflower-patch": 1,
          "rock-pile": 1
        },
        hint: "A heather mat and alpine wildflowers."
      },
      scientificName: "Anthus rubescens",
      role: "A slender ground-walking songbird of open alpine meadows that constantly bobs its tail as it hunts insects. It gleans chilled prey from snowbank margins. Hawks and nest raiders are its chief threats.",
      trophic: "insectivore",
      eatenBy: [
        "fox-alpine"
      ],
      eatsOther: [
        "insects",
        "seeds",
        "spiders"
      ],
      sources: [
        {
          name: "Birds of the World - American Pipit Food Habits",
          url: "https://birdsoftheworld.org/bow/species/amepip/cur/foodhabits"
        },
        {
          name: "Audubon Field Guide - American Pipit",
          url: "https://www.audubon.org/field-guide/bird/american-pipit"
        }
      ]
    },
    {
      id: "ermine",
      name: "Ermine",
      biome: "alpine",
      kind: "mammal",
      rarity: "rare",
      featured: false,
      diet: "Small rodents, especially voles; also pikas, birds, eggs, and insects",
      shelter: "Dens in prey burrows, rock piles, and hollow logs, lined with fur",
      preferredHabitat: "Talus and shrubby edges near meadows with dense rodent prey",
      fact: "Its coat turns pure white in winter except for a jet-black tail tip.",
      requirements: {
        minHealth: 65,
        objects: {
          "rock-pile": 1,
          "krummholz-pine": 1,
          "alpine-wildflower-patch": 1
        },
        animals: [
          "pika"
        ],
        hint: "Rock pile and krummholz, once pikas are back.",
        conditions: {
          season: [
            "winter"
          ]
        }
      },
      scientificName: "Mustela richardsonii",
      role: "A small, fierce weasel that specializes in voles and other rodents, also taking young pikas and ground-bird eggs. It hunts prey burrows it can slip right into. Foxes, martens, and raptors prey on it in turn.",
      trophic: "mesopredator",
      eats: [
        "alpine-chipmunk",
        "mountain-chickadee",
        "pika",
        "ptarmigan",
        "white-crowned-sparrow"
      ],
      eatenBy: [
        "fox-alpine",
        "golden-eagle",
        "pine-marten"
      ],
      eatsOther: [
        "insects",
        "mice",
        "voles"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Mustela erminea",
          url: "https://animaldiversity.org/accounts/Mustela_erminea/"
        },
        {
          name: "Idaho Fish and Game - Mustela erminea",
          url: "https://idfg.idaho.gov/species/taxa/17667"
        }
      ]
    },
    {
      id: "boreal-toad",
      name: "Boreal Toad",
      biome: "alpine",
      kind: "amphibian",
      rarity: "uncommon",
      featured: false,
      diet: "Beetles, ants, flies, and other invertebrates; tadpoles graze algae",
      shelter: "Burrows, rodent holes, logs, and rocks in moist cover near pools",
      preferredHabitat: "Subalpine and alpine wet meadows with open breeding pools",
      fact: "Rocky Mountain boreal toads have crashed from the deadly amphibian chytrid fungus.",
      requirements: {
        minHealth: 55,
        objects: {
          "snowmelt-pool": 1,
          "rock-pile": 1
        },
        water: {
          tiles: 3
        },
        hint: "A snowmelt pool and a few open-water tiles."
      },
      scientificName: "Anaxyrus boreas boreas",
      role: "The high country's only toad, an insect-eating amphibian that breeds in shallow snowmelt pools and takes years to mature. Its tadpoles graze algae. Chytrid fungus has devastated southern populations, making it a conservation flagship.",
      trophic: "insectivore",
      eatenBy: [
        "fox-alpine"
      ],
      eatsOther: [
        "insects",
        "invertebrates"
      ],
      sources: [
        {
          name: "USFS FEIS - Anaxyrus boreas",
          url: "https://www.fs.usda.gov/database/feis/animals/amphibian/anbo/all.html"
        },
        {
          name: "USFWS - Boreal toad species profile",
          url: "https://ecos.fws.gov/ecp/species/D026"
        }
      ]
    },
    {
      id: "mountain-bluebird",
      name: "Mountain Bluebird",
      biome: "alpine",
      kind: "bird",
      rarity: "common",
      featured: false,
      diet: "Mostly insects caught in flight; berries and seeds in colder months",
      shelter: "Old woodpecker holes, natural cavities, and nest boxes",
      preferredHabitat: "Open high meadows with scattered trees and hunting perches",
      fact: "It cannot dig its own hole, so it reuses old woodpecker cavities and nest boxes.",
      requirements: {
        minHealth: 50,
        objects: {
          "krummholz-pine": 1,
          "alpine-wildflower-patch": 1,
          "rock-pile": 1
        },
        hint: "A krummholz pine and alpine wildflowers."
      },
      scientificName: "Sialia currucoides",
      role: "A brilliant sky-blue thrush of open high meadows that hover-hunts insects on the wing and adds berries in the cold. As a cavity nester it depends on old woodpecker holes. Hawks and cavity raiders prey on it.",
      trophic: "insectivore",
      eatsOther: [
        "berries",
        "insects",
        "seeds"
      ],
      sources: [
        {
          name: "Audubon Field Guide - Mountain Bluebird",
          url: "https://www.audubon.org/field-guide/bird/mountain-bluebird"
        },
        {
          name: "Sialis.org - Mountain Bluebird biology",
          url: "https://www.sialis.org/moblbio/"
        }
      ]
    },
    {
      id: "sanderling",
      name: "Sanderling",
      biome: "coastal",
      kind: "bird",
      rarity: "common",
      featured: false,
      diet: "Small crabs, amphipods, worms, and mollusks",
      shelter: "Open beach above the surf line",
      preferredHabitat: "Sandy surf line and wave-washed beach",
      fact: "Sanderlings chase retreating waves in busy little sprints to grab stranded invertebrates.",
      requirements: {
        minHealth: 50,
        objects: {
          "dune-grass": 2,
          tidepool: 1,
          "kelp-wrack": 1
        },
        hint: "Two dune-grass plantings and a tidepool."
      },
      scientificName: "Calidris alba",
      role: "A wave-chasing sandpiper that feeds on small crustaceans and worms churned up by the surf. Falcons are a key predator, and its winter flocks track the health of open sandy beaches.",
      trophic: "insectivore",
      eatsOther: [
        "clams",
        "mole crabs"
      ],
      sources: [
        {
          name: "All About Birds - Sanderling Life History",
          url: "https://www.allaboutbirds.org/guide/Sanderling/lifehistory"
        }
      ]
    },
    {
      id: "black-oystercatcher",
      name: "Black Oystercatcher",
      biome: "coastal",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Mussels and limpets, plus whelks and crabs",
      shelter: "Rocky shore ledges just above the tide",
      preferredHabitat: "Rocky intertidal reefs and tidepool shores",
      fact: "Its long red bill pries shellfish open and cuts the muscle before the shell shuts.",
      requirements: {
        minHealth: 55,
        objects: {
          "oyster-bed": 1,
          tidepool: 1,
          "dune-grass": 1
        },
        hint: "An oyster bed beside a tidepool."
      },
      scientificName: "Haematopus bachmani",
      role: "A rocky-shore specialist that pries mussels and limpets from the rocks, timing feeding to the tides. It is a sensitive indicator of intertidal health, thriving only where shellfish are plentiful.",
      trophic: "mesopredator",
      eats: [
        "mussel",
        "tidepool-crab"
      ],
      eatsOther: [
        "clams",
        "mussels"
      ],
      sources: [
        {
          name: "All About Birds - Black Oystercatcher Life History",
          url: "https://www.allaboutbirds.org/guide/Black_Oystercatcher/lifehistory"
        }
      ]
    },
    {
      id: "purple-shore-crab",
      name: "Purple Shore Crab",
      biome: "coastal",
      kind: "invertebrate",
      rarity: "common",
      featured: false,
      diet: "Sea lettuce and other green algae, plus occasional carrion",
      shelter: "Under rocks in the intertidal",
      preferredHabitat: "Sheltered rocky intertidal under stones",
      fact: "They scrape green algae from rocks and scuttle sideways under stones at low tide.",
      requirements: {
        minHealth: 45,
        objects: {
          tidepool: 1,
          "oyster-bed": 1,
          "dune-grass": 1
        },
        hint: "A tidepool and an oyster bed."
      },
      scientificName: "Hemigrapsus nudus",
      role: "A small grazing crab that scrapes algae from intertidal rocks and occasionally scavenges. It is common prey for gulls, anemones, and tidepool fish, moving algal energy up the food web.",
      trophic: "omnivore",
      eatenBy: [
        "anemone",
        "black-turnstone",
        "gull"
      ],
      eatsOther: [
        "algae",
        "kelp"
      ],
      sources: [
        {
          name: "iNaturalist - Purple Shore Crab (Hemigrapsus nudus)",
          url: "https://www.inaturalist.org/taxa/48342-Hemigrapsus-nudus"
        }
      ]
    },
    {
      id: "brant-goose",
      name: "Brant Goose",
      biome: "coastal",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Eelgrass and large green algae like sea lettuce",
      shelter: "Open shoreline and shallow bays",
      preferredHabitat: "Shallow coastal bays with eelgrass beds",
      fact: "Whole flocks of brant depend on eelgrass beds to fuel their long migrations.",
      requirements: {
        minHealth: 60,
        objects: {
          "eelgrass-bed": 1,
          "dune-grass": 1
        },
        water: {
          tiles: 4
        },
        hint: "An eelgrass bed beside open water."
      },
      scientificName: "Branta bernicla",
      role: "A small sea goose that grazes almost entirely on eelgrass and green algae in shallow bays. Its dependence on eelgrass makes healthy brant flocks a clear indicator of intact seagrass beds.",
      trophic: "herbivore",
      eatsOther: [
        "algae",
        "seagrass"
      ],
      sources: [
        {
          name: "All About Birds - Brant Life History",
          url: "https://www.allaboutbirds.org/guide/Brant/lifehistory"
        }
      ]
    },
    {
      id: "snowy-plover",
      name: "Western Snowy Plover",
      biome: "coastal",
      kind: "bird",
      rarity: "rare",
      featured: false,
      diet: "Beach invertebrates: crustaceans, flies, and small mollusks",
      shelter: "Shallow scrapes on open sand",
      preferredHabitat: "Quiet sandy dunes and open beach",
      fact: "Western snowy plovers nest in tiny scrapes right on the open sand.",
      requirements: {
        minHealth: 60,
        objects: {
          "dune-grass": 1,
          "coastal-nesting-area": 1,
          tidepool: 1
        },
        hint: "Dune grass and a coastal nesting area.",
        conditions: {
          season: [
            "spring",
            "summer"
          ]
        }
      },
      scientificName: "Charadrius nivosus nivosus",
      role: "A threatened beach-nesting plover that feeds on small invertebrates along the sand and tide line. Extremely sensitive to disturbance, it is a flagship indicator of protected, undisturbed dune beaches.",
      trophic: "insectivore",
      eatsOther: [
        "fly larvae",
        "mole crabs"
      ],
      sources: [
        {
          name: "All About Birds - Snowy Plover Life History",
          url: "https://www.allaboutbirds.org/guide/Snowy_Plover/lifehistory"
        },
        {
          name: "USFWS - Western Snowy Plover",
          url: "https://www.fws.gov/species/western-snowy-plover-charadrius-nivosus-nivosus"
        }
      ]
    },
    {
      id: "costas-hummingbird",
      name: "Costa's Hummingbird",
      biome: "desert",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Flower nectar and tiny insects",
      shelter: "Nests in shrubs and cactus",
      preferredHabitat: "Blooming desert with nectar sources",
      fact: "Courting males dive past a female with a shrill whistle, flashing violet throat feathers.",
      requirements: {
        minHealth: 40,
        objects: {
          "nectar-feeder": 1,
          "cactus-patch": 1
        },
        hint: "A nectar feeder beside a cactus patch."
      },
      scientificName: "Calypte costae",
      role: "A small desert hummingbird that feeds on nectar from agave, chuparosa, and other blooms plus tiny insects. It is an important pollinator and a nectar-feeding herbivore. Snakes and predatory birds take it.",
      trophic: "herbivore",
      eatsOther: [
        "insects",
        "nectar"
      ],
      sources: [
        {
          name: "Audubon \u2014 Costa's Hummingbird",
          url: "https://www.audubon.org/field-guide/bird/costas-hummingbird"
        }
      ]
    },
    {
      id: "coopers-hawk",
      name: "Cooper's Hawk",
      biome: "meadow",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Mainly medium and small birds; also chipmunks, mice, and squirrels",
      shelter: "Builds a stick nest high in a tree, on a limb or in a crotch",
      preferredHabitat: "Woodland edges and open country with scattered trees near meadows",
      fact: "Cooper's Hawks thread through dense cover at high speed to ambush songbirds \u2014 a risky style that leaves many with healed chest-bone fractures.",
      requirements: {
        minHealth: 55,
        objects: {
          "oak-tree": 1,
          "bird-perch": 1,
          shrub: 1
        },
        animals: [
          "song-sparrow"
        ],
        hint: "Plant an oak, add a bird perch and a shrub, once sparrows are back."
      },
      scientificName: "Accipiter cooperii",
      role: "A bird-hunting mesopredator that patrols meadow edges and thickets for songbirds. Its agile, low pursuit flight lets it pluck sparrows, finches, and bluebirds from cover. It controls small-bird numbers but can itself be displaced by larger raptors.",
      trophic: "mesopredator",
      eats: [
        "american-goldfinch",
        "barn-swallow",
        "eastern-bluebird",
        "garter-snake-meadow",
        "killdeer",
        "song-sparrow",
        "western-meadowlark"
      ],
      eatsOther: [
        "chipmunks",
        "mice",
        "squirrels"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds \u2014 Cooper's Hawk Life History",
          url: "https://www.allaboutbirds.org/guide/Coopers_Hawk/lifehistory"
        },
        {
          name: "Cornell Lab All About Birds \u2014 Cooper's Hawk Overview",
          url: "https://www.allaboutbirds.org/guide/Coopers_Hawk/overview"
        }
      ]
    },
    {
      id: "western-screech-owl",
      name: "Western Screech-Owl",
      biome: "meadow",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Small mammals and large insects; also small birds and worms",
      shelter: "Roosts and nests in tree cavities, old woodpecker holes, and boxes",
      preferredHabitat: "Wooded edges and brushy areas bordering open meadows",
      fact: "This pint-sized owl occasionally takes prey larger than itself, including cottontail rabbits.",
      requirements: {
        minHealth: 55,
        objects: {
          "oak-tree": 1,
          "hollow-log": 1,
          "log-shelter": 1
        },
        hint: "Plant an oak and craft a hollow log and log shelter."
      },
      scientificName: "Megascops kennicottii",
      role: "A small nocturnal mesopredator that sits and waits, then drops onto rodents and insects, gleaning grasshoppers and beetles and snatching voles and mice on the ground. It bridges insect and rodent control in the meadow at night.",
      trophic: "mesopredator",
      eats: [
        "american-goldfinch",
        "eastern-bluebird",
        "grasshopper",
        "meadow-vole"
      ],
      eatsOther: [
        "deer mice",
        "large insects",
        "worms"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds \u2014 Western Screech-Owl Life History",
          url: "https://www.allaboutbirds.org/guide/Western_Screech-Owl/lifehistory"
        },
        {
          name: "Cornell Lab All About Birds \u2014 Western Screech-Owl Overview",
          url: "https://www.allaboutbirds.org/guide/Western_Screech-Owl/overview"
        }
      ]
    },
    {
      id: "barred-owl",
      name: "Barred Owl",
      biome: "forest",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Small mammals, birds, amphibians, reptiles, fish, and invertebrates",
      shelter: "Large tree cavities in mature forest; also old hawk, crow, or squirrel nests",
      preferredHabitat: "Mature mixed or conifer forest near water with large cavity trees",
      fact: "Barred owls sometimes wade into shallow water to catch fish\u2014unusual hunting for a woodland owl.",
      requirements: {
        minHealth: 55,
        objects: {
          "nesting-tree": 1,
          "oak-tree": 1,
          "standing-deadwood": 1
        },
        hint: "A nesting tree, a planted oak, and standing deadwood."
      },
      scientificName: "Strix varia",
      role: "The barred owl is a mid-level predator that regulates mice, voles, chipmunks, squirrels, and amphibians. It sits between small prey and the apex great horned owl, which is its main predator. Its need for large cavity trees makes it an indicator of mature forest health.",
      trophic: "mesopredator",
      eats: [
        "chipmunk",
        "forest-salamander",
        "garter-snake-forest",
        "little-brown-bat",
        "meadow-vole",
        "northern-flying-squirrel",
        "nuthatch",
        "pacific-wren",
        "pileated-woodpecker",
        "rough-skinned-newt",
        "spotted-towhee",
        "tree-squirrel",
        "wood-duck",
        "woodpecker"
      ],
      eatenBy: [
        "great-horned-owl",
        "raccoon"
      ],
      eatsOther: [
        "crayfish",
        "fish",
        "insects",
        "mice",
        "voles"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Strix varia",
          url: "https://animaldiversity.org/accounts/Strix_varia/"
        },
        {
          name: "Cornell Lab All About Birds \u2014 Barred Owl",
          url: "https://www.allaboutbirds.org/guide/Barred_Owl/lifehistory"
        }
      ]
    },
    {
      id: "fisher",
      name: "Fisher",
      biome: "forest",
      kind: "mammal",
      rarity: "rare",
      featured: false,
      diet: "Small and medium mammals\u2014porcupines, hares, squirrels, mice; also birds and fruit",
      shelter: "Dens in hollow trees, logs, stumps, and ground burrows; young in high tree cavities",
      preferredHabitat: "Dense conifer and mixed forest with high canopy closure and hollow trees",
      fact: "The fisher is one of the only predators that regularly kills porcupines, slashing the face until it can flip it over.",
      requirements: {
        minHealth: 60,
        objects: {
          "birch-tree": 1,
          "tree-stump": 1,
          "mushroom-log": 1
        },
        animals: [
          "tree-squirrel"
        ],
        hint: "Plant a birch, add a stump and mushroom log, once squirrels are back."
      },
      scientificName: "Pekania pennanti",
      role: "The fisher is a powerful mid-level forest predator and one of the few checks on porcupine numbers, which otherwise damage timber. It partly fills the niche of vanished apex predators, and its presence signals mature, connected forest. Young fishers are prey for bobcats, foxes, and lynx.",
      trophic: "mesopredator",
      eats: [
        "bobcat",
        "chipmunk",
        "garter-snake-forest",
        "little-brown-bat",
        "northern-flying-squirrel",
        "pileated-woodpecker",
        "porcupine",
        "raccoon",
        "tree-squirrel",
        "wood-duck",
        "woodpecker"
      ],
      eatenBy: [
        "bobcat",
        "red-fox-forest"
      ],
      eatsOther: [
        "berries",
        "carrion",
        "hares",
        "nuts",
        "shrews",
        "voles"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Martes pennanti",
          url: "https://animaldiversity.org/accounts/Martes_pennanti/"
        },
        {
          name: "NPS \u2014 Species Spotlight: Fisher",
          url: "https://www.nps.gov/articles/netn-species-spotlight-fisher.htm"
        }
      ]
    },
    {
      id: "prothonotary-warbler",
      name: "Prothonotary Warbler",
      biome: "wetland",
      kind: "bird",
      rarity: "rare",
      featured: false,
      diet: "Insects and spiders; some snails, fruit, and seeds off-season",
      shelter: "Tree cavities and nest boxes over standing water",
      preferredHabitat: "Flooded wooded swamp",
      fact: "It is one of only two North American warblers that nest in tree cavities.",
      requirements: {
        minHealth: 55,
        objects: {
          "bald-cypress": 1,
          "reed-bed": 1,
          "nesting-platform": 1
        },
        hint: "Plant a bald cypress with a reed bed and nesting platform.",
        conditions: {
          season: [
            "spring",
            "summer"
          ]
        }
      },
      scientificName: "Protonotaria citrea",
      role: "A glowing-gold swamp warbler that gleans insects and spiders over the water. Unusually for a warbler, it nests in cavities, often above standing water.",
      trophic: "insectivore",
      eatsOther: [
        "insects"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds - Prothonotary Warbler",
          url: "https://www.allaboutbirds.org/guide/Prothonotary_Warbler/lifehistory"
        }
      ]
    },
    {
      id: "green-heron",
      name: "Green Heron",
      biome: "wetland",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Mainly small fish; also insects, crustaceans, and frogs",
      shelter: "Stick nests in trees and shrubs overhanging water",
      preferredHabitat: "Quiet wooded shallows",
      fact: "The green heron drops bait on the water to lure fish within striking range.",
      requirements: {
        minHealth: 55,
        objects: {
          "water-tupelo": 1,
          "lily-pool": 1
        },
        water: {
          tiles: 3
        },
        hint: "Plant a water tupelo by a lily pool and open water."
      },
      scientificName: "Butorides virescens",
      role: "A small, crafty heron of shady shallows and one of few tool-using birds. It fishes patiently and sometimes baits the surface to draw fish close.",
      trophic: "mesopredator",
      eats: [
        "freshwater-fish",
        "northern-leopard-frog"
      ],
      eatsOther: [
        "fish",
        "insects"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds - Green Heron",
          url: "https://www.allaboutbirds.org/guide/Green_Heron/lifehistory"
        }
      ]
    },
    {
      id: "elf-owl",
      name: "Elf Owl",
      biome: "desert",
      kind: "bird",
      rarity: "rare",
      featured: false,
      diet: "Insects and scorpions",
      shelter: "Cavities in cactus and trees",
      preferredHabitat: "Mesquite and saguaro desert",
      fact: "The world's smallest owl plucks the stinger off scorpions before eating them.",
      requirements: {
        minHealth: 55,
        objects: {
          "mesquite-tree": 1,
          "desert-ironwood": 1,
          "cactus-patch": 1
        },
        hint: "Plant a mesquite and an ironwood beside a cactus patch.",
        conditions: {
          dayPhase: [
            "night"
          ],
          season: [
            "spring",
            "summer"
          ]
        }
      },
      scientificName: "Micrathene whitneyi",
      role: "The world's smallest owl, a nocturnal insectivore that hunts insects and scorpions and nests in old woodpecker holes. It is a mesopredator on desert arthropods. Snakes and larger owls threaten it.",
      trophic: "insectivore",
      eats: [
        "scorpion"
      ],
      eatsOther: [
        "insects"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds \u2014 Elf Owl",
          url: "https://www.allaboutbirds.org/guide/Elf_Owl/lifehistory"
        },
        {
          name: "Cornell Lab All About Birds \u2014 Elf Owl Overview",
          url: "https://www.allaboutbirds.org/guide/Elf_Owl/overview"
        }
      ]
    },
    {
      id: "mountain-chickadee",
      name: "Mountain Chickadee",
      biome: "alpine",
      kind: "bird",
      rarity: "common",
      featured: false,
      diet: "Insects and spiders in summer; conifer seeds and nuts in fall and winter",
      shelter: "Old woodpecker holes and natural cavities in conifers and aspen",
      preferredHabitat: "High evergreen forests of pine, fir, and spruce in the West",
      fact: "It caches thousands of seeds and remembers where it hid them.",
      requirements: {
        minHealth: 55,
        objects: {
          "subalpine-fir": 1,
          "krummholz-pine": 1,
          "alpine-wildflower-patch": 1
        },
        hint: "Plant a subalpine fir and krummholz with alpine wildflowers."
      },
      scientificName: "Poecile gambeli",
      role: "A busy conifer-forest insectivore that gleans insects from twigs and switches to cached pine seeds in winter. Often the nucleus of mixed foraging flocks, it disperses conifer seeds. Small hawks, weasels, and martens prey on it and its nestlings.",
      trophic: "insectivore",
      eatenBy: [
        "ermine",
        "fox-alpine",
        "pine-marten"
      ],
      eatsOther: [
        "conifer seeds",
        "insects",
        "seeds",
        "spiders"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds - Mountain Chickadee",
          url: "https://www.allaboutbirds.org/guide/Mountain_Chickadee/lifehistory"
        },
        {
          name: "Audubon Field Guide - Mountain Chickadee",
          url: "https://www.audubon.org/field-guide/bird/mountain-chickadee"
        }
      ]
    },
    {
      id: "pine-grosbeak",
      name: "Pine Grosbeak",
      biome: "alpine",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Buds, seeds, and fruits of conifers and shrubs; some insects in summer",
      shelter: "Concealed cup nest near the trunk of a dense conifer",
      preferredHabitat: "Open subalpine spruce, fir, and pine forest near timberline",
      fact: "A plump, unhurried finch of the cold high forests, nipping buds and needles.",
      requirements: {
        minHealth: 55,
        objects: {
          "quaking-aspen": 1,
          "subalpine-fir": 1,
          "rock-pile": 1
        },
        hint: "Plant an aspen and a subalpine fir near a rock pile."
      },
      scientificName: "Pinicola enucleator",
      role: "A large, sluggish finch that lives almost entirely on conifer buds, seeds, and fruits, adding insects to feed its young. It helps disperse tree and shrub seeds. Martens, small raptors, and foxes prey on it, especially at nests.",
      trophic: "omnivore",
      eatenBy: [
        "fox-alpine",
        "golden-eagle",
        "pine-marten"
      ],
      eatsOther: [
        "berries",
        "conifer buds",
        "insects",
        "seeds"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds - Pine Grosbeak",
          url: "https://www.allaboutbirds.org/guide/Pine_Grosbeak/lifehistory"
        },
        {
          name: "Audubon Field Guide - Pine Grosbeak",
          url: "https://www.audubon.org/field-guide/bird/pine-grosbeak"
        }
      ]
    },
    {
      id: "annas-hummingbird",
      name: "Anna's Hummingbird",
      biome: "coastal",
      kind: "bird",
      rarity: "common",
      featured: false,
      diet: "Flower nectar and small insects",
      shelter: "Shrubs and small trees in coastal scrub",
      preferredHabitat: "Flowering coastal scrub and gardens",
      fact: "Males dive from about 27 m and pull up with a loud chirp made by their tail feathers.",
      requirements: {
        minHealth: 50,
        objects: {
          "monterey-cypress": 1,
          "dune-grass": 1,
          "sea-thrift": 1
        },
        hint: "Plant a Monterey cypress with dune grass and sea thrift."
      },
      scientificName: "Calypte anna",
      role: "A year-round coastal hummingbird that feeds on nectar and small insects, pollinating shrubs like manzanita and gooseberry as it forages. It links flowering coastal scrub to the wider food web.",
      trophic: "omnivore",
      sources: [
        {
          name: "All About Birds - Anna's Hummingbird Life History",
          url: "https://www.allaboutbirds.org/guide/Annas_Hummingbird/lifehistory"
        }
      ]
    },
    {
      id: "acorn-woodpecker",
      name: "Acorn Woodpecker",
      biome: "coastal",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Acorns and insects, plus sap and fruit",
      shelter: "Oak granary trees with stored acorns",
      preferredHabitat: "Coastal oak woodland",
      fact: "It drills thousands of holes in a granary tree and stores a single acorn in each.",
      requirements: {
        minHealth: 55,
        objects: {
          "coast-live-oak": 1,
          "driftwood-shelter": 1,
          tidepool: 1
        },
        hint: "Plant a coast live oak near a driftwood shelter and tidepool."
      },
      scientificName: "Melanerpes formicivorus",
      role: "A social woodpecker that hoards acorns in shared granary trees and hawks flying insects. Its acorn caching and old cavities support other coastal-woodland animals, making it a habitat keystone in oak groves.",
      trophic: "omnivore",
      sources: [
        {
          name: "All About Birds - Acorn Woodpecker Life History",
          url: "https://www.allaboutbirds.org/guide/Acorn_Woodpecker/lifehistory"
        }
      ]
    },
    {
      id: "praying-mantis",
      name: "Praying Mantis",
      biome: "meadow",
      kind: "insect",
      rarity: "uncommon",
      diet: "Ambush predator eating live insects \u2014 bees, grasshoppers, and more",
      shelter: "Perches motionless on plants; lays eggs in a foam egg case (ootheca)",
      preferredHabitat: "Meadows and shrubby edges with dense vegetation for ambush",
      fact: "A praying mantis can swivel its head almost 180 degrees \u2014 unique among insects \u2014 for a wide field of view.",
      requirements: {
        minHealth: 24,
        objects: {
          "grass-patch": 1,
          shrub: 1,
          "insect-hotel": 1
        },
        hint: "Tall grass, a shrub, and an insect hotel give it cover to hunt from."
      },
      scientificName: "Stagmomantis spp. / Mantis religiosa",
      role: "A sit-and-wait ambush mesopredator that seizes prey with spined forelegs in a strike faster than a blink. As a generalist it eats grasshoppers, bees, beetles, and other insects, helping regulate insect numbers. It is itself taken by birds, garter snakes, and small owls.",
      trophic: "mesopredator",
      eats: [
        "bumblebee",
        "grasshopper",
        "lady-beetle",
        "leafcutter-bee",
        "painted-lady",
        "red-admiral"
      ],
      eatenBy: [
        "eastern-bluebird",
        "garter-snake-meadow",
        "song-sparrow",
        "western-meadowlark"
      ],
      eatsOther: [
        "flies",
        "moths",
        "other live insects"
      ],
      sources: [
        {
          name: "NC State Extension \u2014 Praying Mantids",
          url: "https://growingsmallfarms.ces.ncsu.edu/news/challenging-the-conventional-wisdom-about-praying-mantids/"
        },
        {
          name: "National Geographic \u2014 Praying mantis",
          url: "https://www.nationalgeographic.com/animals/invertebrates/facts/praying-mantis"
        }
      ]
    },
    {
      id: "killdeer",
      name: "Killdeer",
      biome: "meadow",
      kind: "bird",
      rarity: "common",
      diet: "Invertebrates \u2014 earthworms, grasshoppers, beetles, and snails",
      shelter: "Nests in a bare ground scrape lined with pebbles and shell bits",
      preferredHabitat: "Open, flat ground with very short grass and scattered stones",
      fact: "Killdeer fake a broken wing, dragging it as if injured to lure predators away from the nest.",
      requirements: {
        minHealth: 35,
        objects: {
          "native-grass-patch": 1,
          "rock-pile": 1,
          "dry-stone-wall": 1
        },
        hint: "Open native grass with a rock pile and a stone wall to nest beside."
      },
      scientificName: "Charadrius vociferus",
      role: "A ground-foraging insectivore that races and halts across open meadow, snapping up worms and insects. As abundant, exposed ground-nesters they are important prey for meadow hunters, which take adults, chicks, and eggs alike.",
      trophic: "insectivore",
      eats: [
        "grasshopper"
      ],
      eatenBy: [
        "coopers-hawk",
        "red-fox-meadow",
        "red-tailed-hawk"
      ],
      eatsOther: [
        "beetles",
        "earthworms",
        "snails"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds \u2014 Killdeer Life History",
          url: "https://www.allaboutbirds.org/guide/Killdeer/lifehistory"
        },
        {
          name: "Audubon Field Guide \u2014 Killdeer",
          url: "https://www.audubon.org/field-guide/bird/killdeer"
        }
      ]
    },
    {
      id: "red-admiral",
      name: "Red Admiral",
      biome: "meadow",
      kind: "insect",
      rarity: "common",
      diet: "Adults prefer tree sap, fermenting fruit, and nectar; caterpillars eat nettles",
      shelter: "Caterpillars fold nettle leaves into shelters; adults roost on trees",
      preferredHabitat: "Flowery clearings and woodland edges near nettle patches",
      fact: "Red admirals are bold and territorial, and will readily land and perch on people who stay still.",
      requirements: {
        minHealth: 30,
        objects: {
          "butterfly-flowers": 1,
          "wildflower-patch": 1,
          "insect-hotel": 1
        },
        hint: "Butterfly flowers and wildflowers beside an insect hotel."
      },
      scientificName: "Vanessa atalanta",
      role: "A fast, territorial butterfly that feeds mainly on tree sap, fruit, and dung, visiting flowers as a nectar pollinator when preferred foods are scarce; its caterpillars specialize on stinging nettles. Lacking chemical defenses, it relies on camouflage and speed to escape birds and other predators.",
      trophic: "herbivore",
      eatenBy: [
        "barn-swallow",
        "praying-mantis"
      ],
      eatsOther: [
        "fermenting fruit",
        "flower nectar",
        "nettles (caterpillar)",
        "tree sap"
      ],
      sources: [
        {
          name: "USDA Forest Service \u2014 Red Admiral Butterfly",
          url: "https://www.fs.usda.gov/wildflowers/pollinators/pollinator-of-the-month/red-admiral-butterfly.shtml"
        },
        {
          name: "Butterflies and Moths of North America \u2014 Red Admiral",
          url: "https://www.butterfliesandmoths.org/species/Vanessa-atalanta"
        }
      ]
    },
    {
      id: "little-brown-bat",
      name: "Little Brown Bat",
      biome: "forest",
      kind: "mammal",
      rarity: "uncommon",
      diet: "Strict insectivore: midges, caddisflies, mayflies, moths, beetles, and mosquitoes",
      shelter: "Roosts in tree hollows, under bark, and in buildings; hibernates in caves and mines",
      preferredHabitat: "Forested land near streams, ponds, and openings for aerial feeding",
      fact: "White-nose syndrome, a cold-loving fungus, has wiped out over 90% of little brown bats at many hibernation sites.",
      requirements: {
        minHealth: 46,
        objects: {
          "bat-box": 1,
          "standing-deadwood": 1,
          shrub: 1
        },
        hint: "A bat box near standing deadwood, with shrubs full of insects."
      },
      scientificName: "Myotis lucifugus",
      role: "Little brown bats are voracious insectivores, each eating up to half its body weight in insects a night and suppressing forest and aquatic pests. They are a mid-web link between the insect layer and larger predators like owls, fishers, and snakes. White-nose syndrome has caused catastrophic declines.",
      trophic: "insectivore",
      eatenBy: [
        "barred-owl",
        "fisher",
        "garter-snake-forest",
        "great-horned-owl",
        "raccoon"
      ],
      eatsOther: [
        "beetles",
        "caddisflies",
        "mayflies",
        "midges",
        "mosquitoes",
        "moths"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Myotis lucifugus",
          url: "https://animaldiversity.org/accounts/Myotis_lucifugus/"
        },
        {
          name: "USGS \u2014 White-Nose Syndrome",
          url: "https://www.usgs.gov/centers/nwhc/science/white-nose-syndrome"
        }
      ]
    },
    {
      id: "ensatina",
      name: "Ensatina Salamander",
      biome: "forest",
      kind: "amphibian",
      rarity: "uncommon",
      diet: "Invertebrates: worms, ants, beetles, spiders, centipedes, millipedes, and snails",
      shelter: "Under rocks, bark, and logs on the forest floor; retreats underground when dry",
      preferredHabitat: "Moist, shaded forest floor rich in coarse woody debris",
      fact: "Ensatinas are lungless, breathing through their skin, and can drop a wriggling, poison-laced tail to escape.",
      requirements: {
        minHealth: 42,
        objects: {
          "leaf-litter-pile": 1,
          "mushroom-log": 1,
          "shallow-water-pool": 1
        },
        hint: "Leaf litter and a mushroom log beside a shallow pool."
      },
      scientificName: "Ensatina eschscholtzii",
      role: "The ensatina is an abundant forest-floor predator that suppresses decomposer invertebrates like centipedes, millipedes, and sowbugs, linking the detritus web to vertebrate predators. Being lungless, it depends on damp, intact forest, making it an indicator of forest-floor moisture. It is prey for garter snakes, raccoons, and jays.",
      trophic: "insectivore",
      eats: [
        "banana-slug"
      ],
      eatenBy: [
        "garter-snake-forest",
        "raccoon"
      ],
      eatsOther: [
        "ants",
        "beetles",
        "centipedes",
        "earthworms",
        "millipedes",
        "snails",
        "spiders"
      ],
      sources: [
        {
          name: "CaliforniaHerps \u2014 Ensatina eschscholtzii",
          url: "https://californiaherps.com/salamanders/pages/e.e.oregonensis.html"
        },
        {
          name: "Animal Diversity Web \u2014 Plethodontidae (lungless salamanders)",
          url: "https://animaldiversity.org/accounts/Plethodontidae/"
        }
      ]
    },
    {
      id: "spotted-towhee",
      name: "Spotted Towhee",
      biome: "forest",
      kind: "bird",
      rarity: "common",
      diet: "Insects and invertebrates in summer; seeds, acorns, and berries in fall and winter",
      shelter: "Dense shrubby thickets and brushy edges; nests on or near the ground",
      preferredHabitat: "Brushy forest edges and chaparral with deep leaf litter",
      fact: "The spotted towhee feeds with a two-footed backward hop that flicks leaf litter aside to expose food.",
      requirements: {
        minHealth: 38,
        objects: {
          "brush-pile": 1,
          shrub: 1,
          "leaf-litter-pile": 1
        },
        hint: "A brush pile and shrubs over a bed of leaf litter."
      },
      scientificName: "Pipilo maculatus",
      role: "The spotted towhee is an omnivorous ground forager that bridges the invertebrate and seed layers, eating ground beetles and caterpillars in summer and dispersing seeds in winter. Its ground nesting leaves it vulnerable to foxes, raccoons, and snakes, while hawks and owls take adults. It helps turn over and recycle forest-floor litter.",
      trophic: "omnivore",
      eatenBy: [
        "barred-owl",
        "bobcat",
        "garter-snake-forest",
        "great-horned-owl",
        "raccoon",
        "red-fox-forest"
      ],
      eatsOther: [
        "acorns",
        "berries",
        "insects",
        "millipedes",
        "seeds",
        "sowbugs",
        "spiders"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds \u2014 Spotted Towhee",
          url: "https://www.allaboutbirds.org/guide/Spotted_Towhee/lifehistory"
        },
        {
          name: "Audubon \u2014 Spotted Towhee",
          url: "https://www.audubon.org/field-guide/bird/spotted-towhee"
        }
      ]
    },
    {
      id: "hooded-merganser",
      name: "Hooded Merganser",
      biome: "wetland",
      kind: "bird",
      rarity: "uncommon",
      diet: "Small fish, crayfish, aquatic insects, and amphibians",
      shelter: "Tree cavities and nest boxes near water",
      preferredHabitat: "Quiet wooded ponds",
      fact: "Hooded merganser ducklings can dive for their own food at just one day old.",
      requirements: {
        minHealth: 46,
        objects: {
          "duck-nest-box": 1,
          "reed-bed": 1
        },
        water: {
          tiles: 3
        },
        hint: "A duck nest box beside reeds and open water."
      },
      scientificName: "Lophodytes cucullatus",
      role: "A small diving duck with a serrated bill for gripping slippery prey. It pursues fish, crayfish, and insects underwater and nests in tree cavities.",
      trophic: "mesopredator",
      eats: [
        "freshwater-fish"
      ],
      eatenBy: [
        "mink"
      ],
      eatsOther: [
        "crayfish",
        "fish",
        "insect larvae"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds - Hooded Merganser",
          url: "https://www.allaboutbirds.org/guide/Hooded_Merganser/lifehistory"
        }
      ]
    },
    {
      id: "spotted-turtle",
      name: "Spotted Turtle",
      biome: "wetland",
      kind: "reptile",
      rarity: "uncommon",
      diet: "Aquatic plants, insects, worms, mollusks, and small invertebrates",
      shelter: "Basking logs and shallow, muddy-bottomed water",
      preferredHabitat: "Sunny shallow marsh",
      fact: "Each spotted turtle wears a unique pattern of yellow polka dots on its shell.",
      requirements: {
        minHealth: 42,
        objects: {
          "basking-log": 1,
          "shallow-water-pool": 1,
          "reed-bed": 1
        },
        hint: "A basking log in a reedy, shallow pool."
      },
      scientificName: "Clemmys guttata",
      role: "A small, declining omnivore that forages underwater for plants and invertebrates. It basks on logs and buries in mud when startled.",
      trophic: "omnivore",
      eatenBy: [
        "muskrat",
        "river-otter"
      ],
      eatsOther: [
        "aquatic plants",
        "insects",
        "worms"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Clemmys guttata",
          url: "https://animaldiversity.org/accounts/Clemmys_guttata/"
        },
        {
          name: "U.S. Fish & Wildlife Service - Spotted Turtle",
          url: "https://www.fws.gov/species/spotted-turtle-clemmys-guttata"
        }
      ]
    },
    {
      id: "common-yellowthroat",
      name: "Common Yellowthroat",
      biome: "wetland",
      kind: "bird",
      rarity: "common",
      diet: "Insects and spiders gleaned from low vegetation",
      shelter: "Bulky grass cups low in cattails and sedges",
      preferredHabitat: "Thick marsh vegetation",
      fact: "The male's black bandit mask is a signal that rivals will attack on sight.",
      requirements: {
        minHealth: 40,
        objects: {
          "cattail-stand": 1,
          "reed-bed": 2
        },
        hint: "A cattail stand among thick reed beds."
      },
      scientificName: "Geothlypis trichas",
      role: "A masked marsh warbler that gleans insects and spiders from dense low cover. It skulks through cattails and briars in search of prey.",
      trophic: "insectivore",
      eatsOther: [
        "insects"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds - Common Yellowthroat",
          url: "https://www.allaboutbirds.org/guide/Common_Yellowthroat/lifehistory"
        }
      ]
    },
    {
      id: "chuckwalla",
      name: "Chuckwalla",
      biome: "desert",
      kind: "reptile",
      rarity: "uncommon",
      diet: "Desert flowers, leaves, and fruit",
      shelter: "Rock crevices",
      preferredHabitat: "Boulder piles near brush",
      fact: "A threatened chuckwalla wedges into a crack and inflates its lungs to lock itself in.",
      requirements: {
        minHealth: 40,
        objects: {
          "rock-crevice": 1,
          "cactus-patch": 1,
          "desert-brush": 1,
          "sunstone-cairn": 1
        },
        hint: "A rock crevice to wedge into, with cactus and brush to graze \u2014 and a sun-warmed cairn to bask on."
      },
      scientificName: "Sauromalus ater",
      role: "A large herbivorous lizard that grazes desert leaves, flowers, and fruit among boulders. It is a plant-eater and prey for hawks, kestrels, coyotes, and rattlesnakes. Its lung-inflation defense locks it into crevices.",
      trophic: "herbivore",
      eatenBy: [
        "coyote",
        "rattlesnake"
      ],
      eatsOther: [
        "flowers",
        "leaves"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Sauromalus ater",
          url: "https://animaldiversity.org/accounts/Sauromalus_ater/"
        }
      ]
    },
    {
      id: "phainopepla",
      name: "Phainopepla",
      biome: "desert",
      kind: "bird",
      rarity: "uncommon",
      diet: "Mistletoe berries and flying insects",
      shelter: "Tall desert brush",
      preferredHabitat: "Brushy desert with water nearby",
      fact: "The phainopepla is desert mistletoe's key seed disperser; the two depend on each other.",
      requirements: {
        minHealth: 46,
        objects: {
          "desert-brush": 2,
          "dew-basin": 1
        },
        hint: "Dense desert brush beside a dew basin."
      },
      scientificName: "Phainopepla nitens",
      role: "A glossy desert songbird whose winter diet is mostly desert mistletoe berries, plus insects caught on the wing. It is a crucial mistletoe seed disperser and a fruit-and-insect omnivore. Snakes and raptors prey on it.",
      trophic: "omnivore",
      eatsOther: [
        "insects",
        "mistletoe berries"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds \u2014 Phainopepla",
          url: "https://www.allaboutbirds.org/guide/Phainopepla/lifehistory"
        },
        {
          name: "Audubon \u2014 Phainopepla",
          url: "https://www.audubon.org/field-guide/bird/phainopepla"
        }
      ]
    },
    {
      id: "antelope-squirrel",
      name: "Antelope Squirrel",
      biome: "desert",
      kind: "mammal",
      rarity: "common",
      diet: "Seeds, fruit, greens, and insects",
      shelter: "Burrows and rock cracks",
      preferredHabitat: "Open desert with burrows",
      fact: "It carries its tail arched over its back like a parasol to shade itself from the sun.",
      requirements: {
        minHealth: 38,
        objects: {
          "burrow-mound": 1,
          "desert-brush": 1,
          "rock-crevice": 1
        },
        hint: "A burrow and a rock crevice among desert brush."
      },
      scientificName: "Ammospermophilus leucurus",
      role: "A diurnal, heat-tolerant omnivore that eats seeds, greens, fruit, and insects even in midday heat. It is prey for hawks, foxes, bobcats, and snakes. It shades itself with its tail and dumps heat on cool ground.",
      trophic: "omnivore",
      eatenBy: [
        "coyote",
        "kit-fox",
        "rattlesnake"
      ],
      eatsOther: [
        "cactus fruit",
        "insects",
        "seeds"
      ],
      sources: [
        {
          name: "Animal Diversity Web \u2014 Ammospermophilus leucurus",
          url: "https://animaldiversity.org/accounts/Ammospermophilus_leucurus/"
        },
        {
          name: "NPS Mojave \u2014 White-tailed Antelope Squirrel",
          url: "https://www.nps.gov/moja/learn/nature/white-tailed-antelope-ground-squirrel.htm"
        }
      ]
    },
    {
      id: "alpine-chipmunk",
      name: "Alpine Chipmunk",
      biome: "alpine",
      kind: "mammal",
      rarity: "common",
      diet: "Seeds of sedges, forbs, and grasses, plus berries, fungi, pine seeds, and eggs",
      shelter: "Nests deep in crevices between talus rocks and boulders",
      preferredHabitat: "High talus slopes and rocky meadows of the Sierra Nevada",
      fact: "It ranges higher than almost any other chipmunk, up to 3,900 meters.",
      requirements: {
        minHealth: 40,
        objects: {
          "talus-pile": 1,
          "alpine-wildflower-patch": 1,
          "rock-pile": 1
        },
        hint: "A talus pile and rock pile among alpine wildflowers."
      },
      scientificName: "Tamias alpinus",
      role: "A tiny, high-altitude seed-eater that caches seeds and helps disperse alpine plants across the talus. It also raids the eggs of rosy-finches and sparrows. Foxes, weasels, martens, and raptors all hunt it, tying it into the predator web.",
      trophic: "herbivore",
      eatenBy: [
        "ermine",
        "fox-alpine",
        "golden-eagle",
        "pine-marten"
      ],
      eatsOther: [
        "alpine plants",
        "berries",
        "fungi",
        "nuts",
        "seeds"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Tamias alpinus",
          url: "https://animaldiversity.org/accounts/Tamias_alpinus/"
        },
        {
          name: "IUCN Red List - Tamias alpinus",
          url: "https://www.iucnredlist.org/species/42568/22268290"
        }
      ]
    },
    {
      id: "white-crowned-sparrow",
      name: "White-crowned Sparrow",
      biome: "alpine",
      kind: "bird",
      rarity: "common",
      diet: "Mainly weed and grass seeds, plus caterpillars, beetles, and other insects",
      shelter: "Ground or low-shrub cup nest among mosses, lichens, and heath",
      preferredHabitat: "Krummholz edges, alpine meadows, and heath with bare ground",
      fact: "Young white-crowns learn their song dialect from the neighbours nearby.",
      requirements: {
        minHealth: 48,
        objects: {
          "heather-mat": 1,
          "alpine-nest-shelf": 1,
          "krummholz-pine": 1
        },
        hint: "A heather mat and nest shelf sheltered by krummholz pine."
      },
      scientificName: "Zonotrichia leucophrys",
      role: "A ground-foraging sparrow of alpine meadow and krummholz edges that eats seeds and summer insects. It disperses seeds and feeds insect larvae to its chicks. Foxes, weasels, and martens hunt the adults and raid its low nests.",
      trophic: "omnivore",
      eatenBy: [
        "ermine",
        "fox-alpine",
        "pine-marten"
      ],
      eatsOther: [
        "berries",
        "insects",
        "seeds"
      ],
      sources: [
        {
          name: "Cornell Lab All About Birds - White-crowned Sparrow",
          url: "https://www.allaboutbirds.org/guide/White-crowned_Sparrow/lifehistory"
        },
        {
          name: "Audubon Field Guide - White-crowned Sparrow",
          url: "https://www.audubon.org/field-guide/bird/white-crowned-sparrow"
        }
      ]
    },
    {
      id: "cascades-frog",
      name: "Cascades Frog",
      biome: "alpine",
      kind: "amphibian",
      rarity: "rare",
      diet: "An aquatic and semiaquatic insectivore, taking insects and spiders",
      shelter: "Snowmelt ponds and lakes; hibernates in soil under lake bottoms",
      preferredHabitat: "Cold high-country ponds and streams near coniferous forest",
      fact: "It stays active in near-freezing snowmelt water and basks on wet rocks.",
      requirements: {
        minHealth: 52,
        objects: {
          "snowmelt-pool": 1,
          "talus-pile": 1
        },
        water: {
          tiles: 3
        },
        hint: "A snowmelt pool beside a talus pile, with open water near.",
        conditions: {
          weather: [
            "rain"
          ],
          season: [
            "spring",
            "summer"
          ]
        }
      },
      scientificName: "Rana cascadae",
      role: "A cold-adapted mountain frog that eats insects and spiders while its tadpoles graze algae in snowmelt pools. It links pond invertebrates to larger predators. Introduced trout eat its tadpoles, driving steep declines across its southern range.",
      trophic: "insectivore",
      eatenBy: [
        "fox-alpine",
        "snowmelt-trout"
      ],
      eatsOther: [
        "aquatic insects",
        "insects",
        "spiders"
      ],
      sources: [
        {
          name: "Animal Diversity Web - Rana cascadae",
          url: "https://animaldiversity.org/accounts/Rana_cascadae/"
        },
        {
          name: "IUCN Red List - Rana cascadae",
          url: "https://www.iucnredlist.org/species/19176/78907070"
        }
      ]
    },
    {
      id: "black-turnstone",
      name: "Black Turnstone",
      biome: "coastal",
      kind: "bird",
      rarity: "common",
      diet: "Barnacles, limpets, mussels, and small invertebrates",
      shelter: "Rocky shoreline and beach wrack",
      preferredHabitat: "Rocky intertidal shores",
      fact: "Turnstones flip over stones and shells to snatch the creatures hiding beneath.",
      requirements: {
        minHealth: 40,
        objects: {
          tidepool: 1,
          "driftwood-pile": 1,
          "kelp-wrack": 1
        },
        hint: "Tidepools and kelp wrack with a driftwood pile to shelter in."
      },
      scientificName: "Arenaria melanocephala",
      role: "A rocky-shore forager that pries barnacles and limpets loose and flips wrack to find hidden prey. It helps keep intertidal invertebrate numbers in check and depends on rich rocky shores.",
      trophic: "insectivore",
      eats: [
        "hermit-crab",
        "mussel",
        "purple-shore-crab",
        "tidepool-crab"
      ],
      eatsOther: [
        "barnacles",
        "mussels"
      ],
      sources: [
        {
          name: "All About Birds - Black Turnstone Life History",
          url: "https://www.allaboutbirds.org/guide/Black_Turnstone/lifehistory"
        }
      ]
    },
    {
      id: "pigeon-guillemot",
      name: "Pigeon Guillemot",
      biome: "coastal",
      kind: "bird",
      rarity: "uncommon",
      diet: "Small fish, plus crabs, worms, and mollusks",
      shelter: "Bluff and rock crevices above water",
      preferredHabitat: "Rocky nesting bluffs over clear water",
      fact: "Pigeon guillemots have bright coral-red feet and matching mouth linings.",
      requirements: {
        minHealth: 52,
        objects: {
          "nesting-bluff": 1,
          "oyster-bed": 1
        },
        water: {
          tiles: 4
        },
        hint: "A nesting bluff above open water near an oyster bed."
      },
      scientificName: "Cepphus columba",
      role: "A diving seabird that chases small fish and pries invertebrates from crevices near the seafloor. It nests in rocky bluffs and depends on the healthy nearshore fish and habitat that kelp forests support.",
      trophic: "apex-predator",
      eatsOther: [
        "fish"
      ],
      sources: [
        {
          name: "All About Birds - Pigeon Guillemot Life History",
          url: "https://www.allaboutbirds.org/guide/Pigeon_Guillemot/lifehistory"
        }
      ]
    },
    {
      id: "bat-star",
      name: "Bat Star",
      biome: "coastal",
      kind: "invertebrate",
      rarity: "common",
      diet: "Algae, detritus, and dead plants and animals",
      shelter: "Tidepools and eelgrass beds",
      preferredHabitat: "Shallow rocky tidepools and eelgrass",
      fact: "A bat star can have anywhere from four to nine arms, not always five.",
      requirements: {
        minHealth: 45,
        objects: {
          tidepool: 2,
          "eelgrass-bed": 1
        },
        hint: "A couple of tidepools with an eelgrass bed."
      },
      scientificName: "Patiria miniata",
      role: "An omnivorous scavenger that spreads its stomach over the seafloor to digest algae and carrion. It is a cleanup crew of the shallows, recycling dead matter and keeping tidepools and eelgrass beds tidy.",
      trophic: "scavenger",
      eatsOther: [
        "algae"
      ],
      sources: [
        {
          name: "Monterey Bay Aquarium - Bat star",
          url: "https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/bat-star"
        },
        {
          name: "Animal Diversity Web - Patiria miniata",
          url: "https://animaldiversity.org/accounts/Patiria_miniata/"
        }
      ]
    }
  ]
};

// data/achievements.json
var achievements_default = {
  database: "wildwillows",
  table: "Achievement",
  records: [
    {
      id: "welcome-grasshopper",
      name: "First Friend",
      biome: "preserve",
      category: "getting-started",
      order: 1,
      points: 10,
      hidden: false,
      icon: "ach-grasshopper",
      flavor: "You saw it through \u2014 gathered, built, shaped the land, and welcomed your first neighbor. A single hop in the grass, and you already know how to bring back a whole meadow.",
      hint: "Every caretaker's journey begins with one small arrival.",
      req: {
        t: "animal",
        ids: [
          "grasshopper"
        ]
      }
    },
    {
      id: "forager",
      name: "Forager",
      biome: "preserve",
      category: "getting-started",
      order: 2,
      points: 10,
      hidden: false,
      icon: "ach-gather-hand",
      flavor: "A hundred fallen things picked up and put to use. You've stopped scrounging and started stockpiling.",
      hint: "Gather, and keep gathering \u2014 build a real stockpile.",
      req: {
        t: "collect",
        n: 100
      }
    },
    {
      id: "makers-hands",
      name: "Maker's Hands",
      biome: "preserve",
      category: "getting-started",
      order: 3,
      points: 10,
      hidden: false,
      icon: "ach-mallet",
      flavor: "Ten things built by hand. Habitat isn't found \u2014 it's made, one piece at a time.",
      hint: "Keep crafting; one item won't restore a meadow.",
      req: {
        t: "craft",
        n: 10
      }
    },
    {
      id: "green-thumb",
      name: "Green Thumb",
      biome: "preserve",
      category: "getting-started",
      order: 4,
      points: 10,
      hidden: false,
      icon: "ach-sprout-thumb",
      flavor: "Ten living things in soil you readied yourself. Half of restoration is just patience with a watering can.",
      hint: "Put down roots \u2014 plant, and plant again.",
      req: {
        t: "plant",
        n: 10
      }
    },
    {
      id: "waterworks",
      name: "Waterworks",
      biome: "preserve",
      category: "getting-started",
      order: 5,
      points: 10,
      hidden: false,
      icon: "ach-droplet-ripple",
      flavor: "Beds dug, ground watered, the first pools shaped. Wet ground is the difference between bare dirt and a place that holds life.",
      hint: "Work the soil and bring it water, again and again.",
      req: {
        t: "terraform",
        n: 15
      }
    },
    {
      id: "meadow-first-bloom",
      name: "First Bloom",
      biome: "meadow",
      category: "biome",
      order: 6,
      points: 15,
      hidden: false,
      icon: "ach-wildflower",
      flavor: "Grasshopper, then a bee, then a sparrow that eats both, then a fox that eats the sparrow. A food web is just neighbors who need each other.",
      hint: "Coax the meadow well past its first lonely visitor.",
      req: {
        t: "returned",
        biome: "meadow",
        n: 8
      }
    },
    {
      id: "meadow-pollinators",
      name: "Pollinator Highway",
      biome: "meadow",
      category: "biome",
      order: 7,
      points: 20,
      hidden: false,
      icon: "ach-butterfly",
      flavor: "Monarch, bumblebee, leafcutter, lady beetle, painted lady \u2014 the unpaid workforce that turns flowers into seeds and seeds into more meadow.",
      hint: "Bring back the meadow's little winged workforce.",
      req: {
        t: "kindReturned",
        biome: "meadow",
        kind: "insect",
        n: 5
      }
    },
    {
      id: "meadow-apex",
      name: "Apex of the Grass",
      biome: "meadow",
      category: "biome",
      order: 8,
      points: 25,
      hidden: false,
      icon: "ach-fox-head",
      flavor: "A fox only settles where there are voles and rabbits to hunt \u2014 so its arrival means the whole chain beneath it is finally fed.",
      hint: "A meadow is whole when its top hunter trusts it.",
      req: {
        t: "animal",
        ids: [
          "red-fox-meadow"
        ]
      }
    },
    {
      id: "meadow-mender",
      name: "Meadow Mender",
      biome: "meadow",
      category: "biome",
      order: 9,
      points: 25,
      hidden: false,
      icon: "ach-grass-tuft",
      flavor: "The dust is gone. Where you started there was bare ground; now there's a meadow that hums.",
      hint: "Heal Willow Meadow most of the way back.",
      req: {
        t: "health",
        biome: "meadow",
        n: 80
      }
    },
    {
      id: "meadow-reborn",
      name: "Willow Meadow Reborn",
      biome: "meadow",
      category: "biome",
      order: 10,
      points: 50,
      hidden: false,
      icon: "ach-meadow-sun",
      flavor: "Every animal that belongs here is home. The meadow doesn't need you to hum anymore \u2014 but it remembers who started it.",
      hint: "Leave no meadow animal behind.",
      req: {
        t: "returned",
        biome: "meadow",
        n: 25
      }
    },
    {
      id: "forest-understory",
      name: "Understory Returns",
      biome: "forest",
      category: "biome",
      order: 11,
      points: 15,
      hidden: false,
      icon: "ach-fern",
      flavor: "Ferns, shrubs, a squirrel arguing with a woodpecker, newts under the deadwood. A forest is built from the ground up, not the canopy down.",
      hint: "Rebuild the forest floor, layer by layer.",
      req: {
        t: "returned",
        biome: "forest",
        n: 10
      }
    },
    {
      id: "forest-cavities",
      name: "Hollow Dwellers",
      biome: "forest",
      category: "biome",
      order: 12,
      points: 25,
      hidden: false,
      icon: "ach-tree-hollow",
      flavor: "The big woodpecker carves a hole, uses it once, and leaves it for everyone else. One bird's old home is another's new one.",
      hint: "Some birds carve homes that others move into \u2014 gather that crowd.",
      req: {
        t: "animalChain",
        all: [
          "pileated-woodpecker"
        ],
        any: [
          "wood-duck",
          "northern-flying-squirrel",
          "great-horned-owl",
          "barred-owl"
        ]
      }
    },
    {
      id: "forest-night-shift",
      name: "Night Shift",
      biome: "forest",
      category: "biome",
      order: 13,
      points: 25,
      hidden: false,
      icon: "ach-owl-moon",
      flavor: "After dark a second forest wakes up. The owls hunt what the day birds never see, and the bats take the night's insects.",
      hint: "Wake the forest that only stirs after dark.",
      req: {
        t: "animal",
        ids: [
          "great-horned-owl",
          "barred-owl",
          "little-brown-bat"
        ],
        mode: "all"
      }
    },
    {
      id: "forest-canopy",
      name: "Canopy Restored",
      biome: "forest",
      category: "biome",
      order: 14,
      points: 25,
      hidden: false,
      icon: "ach-conifer",
      flavor: "Shade on the forest floor again. The big trees you raised will outlive everyone reading their rings.",
      hint: "Raise Old Hollow Forest most of the way back.",
      req: {
        t: "health",
        biome: "forest",
        n: 80
      }
    },
    {
      id: "forest-reborn",
      name: "Old Hollow Forest Reborn",
      biome: "forest",
      category: "biome",
      order: 15,
      points: 50,
      hidden: false,
      icon: "ach-three-trees",
      flavor: "From a logged-over silence to a full, layered wood \u2014 floor, understory, canopy, and every wing in between.",
      hint: "Leave no forest animal behind.",
      req: {
        t: "returned",
        biome: "forest",
        n: 25
      }
    },
    {
      id: "wetland-first-water",
      name: "Water Returns",
      biome: "wetland",
      category: "biome",
      order: 16,
      points: 15,
      hidden: false,
      icon: "ach-cattail",
      flavor: "Shape the water and the water brings its own crowd \u2014 frogs, striders, dragonflies skating the surface, a heron stalking the shallows.",
      hint: "Shape water, and life will find it.",
      req: {
        t: "returned",
        biome: "wetland",
        n: 8
      }
    },
    {
      id: "wetland-engineer",
      name: "The Engineer",
      biome: "wetland",
      category: "biome",
      order: 17,
      points: 25,
      hidden: false,
      icon: "ach-beaver-dam",
      flavor: "The beaver doesn't move into habitat \u2014 it builds it. One dam, and otters, herons, and frogs all get a home they couldn't have made themselves.",
      hint: "Welcome the one who builds habitat for everyone else.",
      req: {
        t: "animal",
        ids: [
          "beaver"
        ]
      }
    },
    {
      id: "wetland-lakemaker",
      name: "Lakemaker",
      biome: "wetland",
      category: "biome",
      order: 18,
      points: 20,
      hidden: false,
      icon: "ach-lake",
      flavor: "Enough open water to hold a sky. Turtles bask, mergansers dive, and the whole marsh has a center again.",
      hint: "Open enough connected water to hold a sky.",
      req: {
        t: "lake",
        biome: "wetland",
        n: 6
      }
    },
    {
      id: "wetland-restored",
      name: "Marsh Restored",
      biome: "wetland",
      category: "biome",
      order: 19,
      points: 25,
      hidden: false,
      icon: "ach-heron",
      flavor: "Reeds where there was cracked mud, channels that actually flow. A wetland filters everything downstream of it \u2014 quiet, unpaid work.",
      hint: "Heal Rushwater Wetland most of the way back.",
      req: {
        t: "health",
        biome: "wetland",
        n: 80
      }
    },
    {
      id: "wetland-reborn",
      name: "Rushwater Wetland Reborn",
      biome: "wetland",
      category: "biome",
      order: 20,
      points: 50,
      hidden: false,
      icon: "ach-marsh-sun",
      flavor: "Crane to minnow, the whole drained marsh is wet and loud and alive.",
      hint: "Leave no wetland animal behind.",
      req: {
        t: "returned",
        biome: "wetland",
        n: 25
      }
    },
    {
      id: "desert-first-life",
      name: "Life in the Heat",
      biome: "desert",
      category: "biome",
      order: 21,
      points: 15,
      hidden: false,
      icon: "ach-cactus",
      flavor: "Out here life hides from the sun, not in it. The brush and burrows you've built are the first shade anything's had in years.",
      hint: "Give the heat something to hide in.",
      req: {
        t: "returned",
        biome: "desert",
        n: 8
      }
    },
    {
      id: "desert-burrows",
      name: "Burrow Network",
      biome: "desert",
      category: "biome",
      order: 22,
      points: 25,
      hidden: false,
      icon: "ach-burrow",
      flavor: "In the desert, real estate is underground. A tortoise digs a burrow and an owl moves into the spare room \u2014 nobody wastes a hole here.",
      hint: "In the desert, the right neighbors share their holes.",
      req: {
        t: "animal",
        ids: [
          "burrowing-owl",
          "kangaroo-rat",
          "desert-tortoise"
        ],
        mode: "all"
      }
    },
    {
      id: "desert-hunter",
      name: "Dryland Hunter",
      biome: "desert",
      category: "biome",
      order: 23,
      points: 25,
      hidden: false,
      icon: "ach-rattlesnake",
      flavor: "A predator that can wait out the heat means there's finally enough prey to be patient for.",
      hint: "A hunter that waits out the heat needs prey worth waiting for.",
      req: {
        t: "animal",
        ids: [
          "rattlesnake",
          "coyote"
        ],
        mode: "any"
      }
    },
    {
      id: "desert-restored",
      name: "Scrubland Restored",
      biome: "desert",
      category: "biome",
      order: 24,
      points: 25,
      hidden: false,
      icon: "ach-agave",
      flavor: "Brush and cactus where there was overgrazed flat. You can't flood a desert back \u2014 you have to shade it back, and you did.",
      hint: "Bring Redstone Scrubland most of the way back.",
      req: {
        t: "health",
        biome: "desert",
        n: 80
      }
    },
    {
      id: "desert-reborn",
      name: "Redstone Scrubland Reborn",
      biome: "desert",
      category: "biome",
      order: 25,
      points: 50,
      hidden: false,
      icon: "ach-desert-sun",
      flavor: "The hardest country in the preserve, fully alive \u2014 from the elf owl in the cactus to the tarantula under the stone.",
      hint: "Leave no desert animal behind.",
      req: {
        t: "returned",
        biome: "desert",
        n: 25
      }
    },
    {
      id: "alpine-treeline",
      name: "Above the Treeline",
      biome: "alpine",
      category: "biome",
      order: 26,
      points: 15,
      hidden: false,
      icon: "ach-peak",
      flavor: "Nothing up here is here by accident. Every one of these has chosen the thin air on purpose.",
      hint: "Coax the first hardy few above the trees.",
      req: {
        t: "returned",
        biome: "alpine",
        n: 8
      }
    },
    {
      id: "alpine-haypile",
      name: "The Haymaker",
      biome: "alpine",
      category: "biome",
      order: 27,
      points: 20,
      hidden: false,
      icon: "ach-pika",
      flavor: "The pika spends all summer stacking little hay piles for a winter it refuses to sleep through. Tiny animal, enormous work ethic.",
      hint: "Welcome the tireless little hay-stacker of the rocks.",
      req: {
        t: "animal",
        ids: [
          "pika"
        ]
      }
    },
    {
      id: "alpine-crown",
      name: "Crown of the Range",
      biome: "alpine",
      category: "biome",
      order: 28,
      points: 25,
      hidden: false,
      icon: "ach-eagle",
      flavor: "When the eagle circles the ridge, the marmots whistle and the whole slope listens. The top of the food web has come home.",
      hint: "Crown the range with its highest hunter.",
      req: {
        t: "animal",
        ids: [
          "golden-eagle"
        ]
      }
    },
    {
      id: "alpine-restored",
      name: "Heights Restored",
      biome: "alpine",
      category: "biome",
      order: 29,
      points: 25,
      hidden: false,
      icon: "ach-alpine-flower",
      flavor: "Wildflower turf knitted back over the talus. Up here things grow by the inch and recover by the decade \u2014 you sped it up.",
      hint: "Bring Graywind Heights most of the way back.",
      req: {
        t: "health",
        biome: "alpine",
        n: 80
      }
    },
    {
      id: "alpine-reborn",
      name: "Graywind Heights Reborn",
      biome: "alpine",
      category: "biome",
      order: 30,
      points: 50,
      hidden: false,
      icon: "ach-range",
      flavor: "Goat to ptarmigan to trout in the snowmelt \u2014 the whole high country, restored against the wind.",
      hint: "Leave no alpine animal behind.",
      req: {
        t: "returned",
        biome: "alpine",
        n: 25
      }
    },
    {
      id: "coastal-tide",
      name: "The Tide Returns",
      biome: "coastal",
      category: "biome",
      order: 31,
      points: 15,
      hidden: false,
      icon: "ach-wave",
      flavor: "Crabs in the wrack line, anemones in the pools, gulls working the surf. The tide was always coming in \u2014 now there's a whole shore to meet it.",
      hint: "Give the tide a shore worth returning to.",
      req: {
        t: "returned",
        biome: "coastal",
        n: 8
      }
    },
    {
      id: "coastal-keystone",
      name: "Keystone",
      biome: "coastal",
      category: "biome",
      order: 32,
      points: 25,
      hidden: false,
      icon: "ach-seastar",
      flavor: "The textbook keystone species: pull the sea star out and the mussels take everything. Put it back and the whole tidepool shares the rock again.",
      hint: "Restore the one animal that holds the whole tidepool together.",
      req: {
        t: "animal",
        ids: [
          "sea-star"
        ]
      }
    },
    {
      id: "coastal-otter",
      name: "Otter's Garden",
      biome: "coastal",
      category: "biome",
      order: 33,
      points: 25,
      hidden: false,
      icon: "ach-otter",
      flavor: "Otters eat the urchins that eat the kelp \u2014 so an otter on the water means a forest under it. Few animals do more with a full belly.",
      hint: "Welcome the swimmer that keeps the kelp standing.",
      req: {
        t: "animal",
        ids: [
          "sea-otter"
        ]
      }
    },
    {
      id: "coastal-restored",
      name: "Shore Restored",
      biome: "coastal",
      category: "biome",
      order: 34,
      points: 25,
      hidden: false,
      icon: "ach-shell",
      flavor: "Anchored dunes, full tidepools, kelp in the wrack. The edge of the whole preserve, holding the line against the sea.",
      hint: "Bring Pelican Shore most of the way back.",
      req: {
        t: "health",
        biome: "coastal",
        n: 80
      }
    },
    {
      id: "coastal-reborn",
      name: "Pelican Shore Reborn",
      biome: "coastal",
      category: "biome",
      order: 35,
      points: 50,
      hidden: false,
      icon: "ach-pelican",
      flavor: "Whale-spout to clam-siphon. The last and wildest stretch of the preserve, complete.",
      hint: "Leave no coastal animal behind.",
      req: {
        t: "returned",
        biome: "coastal",
        n: 25
      }
    },
    {
      id: "well-stocked",
      name: "Well Stocked",
      biome: "preserve",
      category: "mastery",
      order: 36,
      points: 25,
      hidden: false,
      icon: "ach-full-basket",
      flavor: "A thousand fallen things gathered. You stopped scrounging long ago \u2014 this is provisioning.",
      hint: "Gather far past what any one project needs.",
      req: {
        t: "collect",
        n: 1e3
      }
    },
    {
      id: "master-builder",
      name: "Master Builder",
      biome: "preserve",
      category: "mastery",
      order: 37,
      points: 25,
      hidden: false,
      icon: "ach-blueprint",
      flavor: "A hundred and fifty pieces of habitat, placed by hand. The whole preserve has your fingerprints on it.",
      hint: "Place habitat until the whole preserve bears your hand.",
      req: {
        t: "place",
        n: 150
      }
    },
    {
      id: "master-gardener",
      name: "Master Gardener",
      biome: "preserve",
      category: "mastery",
      order: 38,
      points: 25,
      hidden: false,
      icon: "ach-watering-can",
      flavor: "Seventy-five living things put in the ground, sprout by patient sprout. Restoration is mostly just showing up with a watering can.",
      hint: "Plant on a scale that changes the land.",
      req: {
        t: "plant",
        n: 75
      }
    },
    {
      id: "landscaper",
      name: "Landscaper",
      biome: "preserve",
      category: "mastery",
      order: 39,
      points: 25,
      hidden: false,
      icon: "ach-spade-water",
      flavor: "You don't find the right land \u2014 you shape it. Beds, banks, ponds, lakes, and rivers, all on purpose.",
      hint: "Shape soil and water across the preserve, tirelessly.",
      req: {
        t: "terraform",
        n: 150
      }
    },
    {
      id: "fully-equipped",
      name: "Fully Equipped",
      biome: "preserve",
      category: "mastery",
      order: 40,
      points: 30,
      hidden: false,
      icon: "ach-toolbelt",
      flavor: "Top-tier gear for top-tier work. There's nothing left in the preserve you can't carry, dig, or water.",
      hint: "Carry your basket, shovel, and watering can to their peak.",
      req: {
        t: "tools",
        n: 4
      }
    },
    {
      id: "naturalist",
      name: "Naturalist",
      biome: "preserve",
      category: "mastery",
      order: 41,
      points: 30,
      hidden: false,
      icon: "ach-open-book",
      flavor: "Every guide filled in, every animal's secrets unlocked. You don't just host wildlife now \u2014 you understand it.",
      hint: "Complete every area's field guide.",
      req: {
        t: "tool",
        id: "field-journal",
        n: 7
      }
    },
    {
      id: "recipe-collector",
      name: "Recipe Collector",
      biome: "preserve",
      category: "mastery",
      order: 42,
      points: 30,
      hidden: false,
      icon: "ach-recipe-stack",
      flavor: "Seventy-five different things, each built at least once. You've used nearly every tool on the bench.",
      hint: "Build a little of almost everything on the bench.",
      req: {
        t: "craftDistinct",
        n: 75
      }
    },
    {
      id: "open-road",
      name: "Open Road",
      biome: "preserve",
      category: "preserve",
      order: 43,
      points: 20,
      hidden: false,
      icon: "ach-trail-gate",
      flavor: "The first trail gate swings open. One healed meadow, and the whole preserve starts to feel reachable.",
      hint: "Heal one biome enough to open the next trail.",
      req: {
        t: "unlocked",
        n: 2
      }
    },
    {
      id: "welcoming-committee",
      name: "Welcoming Committee",
      biome: "preserve",
      category: "preserve",
      order: 44,
      points: 30,
      hidden: false,
      icon: "ach-paws-fifty",
      flavor: "Fifty species have decided this place is safe again. Word travels fast in the wild.",
      hint: "Draw a real crowd back to the preserve.",
      req: {
        t: "total",
        n: 50
      }
    },
    {
      id: "full-house",
      name: "Full House",
      biome: "preserve",
      category: "preserve",
      order: 45,
      points: 50,
      hidden: false,
      icon: "ach-preserve-map",
      flavor: "A hundred kinds of neighbor. The preserve isn't recovering anymore \u2014 it's thriving.",
      hint: "Fill the preserve with neighbors.",
      req: {
        t: "total",
        n: 100
      }
    },
    {
      id: "field-notes",
      name: "Field Notes",
      biome: "preserve",
      category: "preserve",
      order: 46,
      points: 25,
      hidden: false,
      icon: "ach-binoculars",
      flavor: "Page after page of observations. You don't just bring animals back \u2014 you sit with them long enough to learn who they are.",
      hint: "Observe your wild neighbors, again and again, all over the preserve.",
      req: {
        t: "observe",
        n: 100
      }
    },
    {
      id: "steady-hand",
      name: "Steady Hand",
      biome: "preserve",
      category: "preserve",
      order: 47,
      points: 30,
      hidden: false,
      icon: "ach-balance-leaf",
      flavor: "No biome left to languish while you favored another. Every place you've opened is in good health at once.",
      hint: "Keep every area you've opened in good health at the same time.",
      req: {
        t: "healthyOpen",
        h: 50,
        min: 3
      }
    },
    {
      id: "three-restored",
      name: "Halfway Wild",
      biome: "preserve",
      category: "preserve",
      order: 48,
      points: 35,
      hidden: false,
      icon: "ach-triple-leaf",
      flavor: "Three damaged places, brought most of the way home. The preserve is tipping from recovering to recovered.",
      hint: "Bring several different biomes most of the way back.",
      req: {
        t: "biomesAtHealth",
        h: 80,
        n: 3
      }
    },
    {
      id: "trailblazer",
      name: "Trailblazer",
      biome: "preserve",
      category: "preserve",
      order: 49,
      points: 40,
      hidden: false,
      icon: "ach-signpost",
      flavor: "Every gate open, every trail walked. From your tent to the sea, it's all connected now.",
      hint: "Open every trail in the preserve.",
      req: {
        t: "unlocked",
        n: 6
      }
    },
    {
      id: "caretaker-of-the-whole",
      name: "Caretaker of the Whole",
      biome: "preserve",
      category: "preserve",
      order: 50,
      points: 100,
      hidden: false,
      icon: "ach-laurel",
      flavor: "Every animal in every biome, home. The damaged preserve you inherited is now, simply, wild. The rarest achievement there is.",
      hint: "Welcome home every animal in every biome.",
      req: {
        t: "total",
        n: 150
      }
    }
  ]
};

// data/weather.json
var weather_default = {
  _comment: "Weather is DERIVED, not stored. This file is static config consumed by server/weather.ts \u2014 it is NOT a seeded Harper table, so it needs no schema entry and never goes through reconcileDefinitions. `config` sets the time scale; `seasons` lists the cycle order; `types` defines each weather kind (visuals + Phase 3 effect params); `climate` is per-biome \xD7 per-season weighted odds used to draw each game-day's weather deterministically.",
  config: {
    dayMs: 72e4,
    daysPerSeason: 3,
    dayPhases: [
      { id: "night", until: 0.2083 },
      { id: "dawn", until: 0.2917 },
      { id: "day", until: 0.75 },
      { id: "dusk", until: 0.8333 },
      { id: "night", until: 1 }
    ]
  },
  seasons: ["spring", "summer", "autumn", "winter"],
  gather: {
    _comment: "biome \u2192 weather type \u2192 resource id. A weather-gated gather node for that resource appears in the biome ONLY while that weather is active. The same weather can yield different resources in different biomes (e.g. a desert storm fuses sand into stormglass; a temperate rain just pools rainwater).",
    meadow: { rain: "rainwater", fog: "dewdrops" },
    forest: { rain: "rainwater", fog: "dewdrops" },
    wetland: { rain: "rainwater", fog: "dewdrops" },
    desert: { heat: "sunstone", storm: "stormglass" },
    alpine: { snow: "frostflower", fog: "dewdrops" },
    coastal: { storm: "stormglass", fog: "dewdrops" }
  },
  effects: {
    _comment: "Educational ecology grounded in credible sources (USGS, NOAA/NWS, NPS, US FWS, EPA, university extension, Britannica, Audubon, Smithsonian). Shown in the weather menu for the biome you're standing in while that weather is happening. `_default` applies unless a biome-specific line is given.",
    clear: {
      _default: "Bright, sunny days are when most green life does its best work, soaking up sunlight to grow. Pollinators like bees and butterflies are most active in clear, warm weather, and many animals bask to warm up before the day's business begins.",
      desert: "Deserts get punishing amounts of sunlight, and with little water or plant cover the bare ground heats fast. Because the dry, cloudless air holds almost no moisture, that heat escapes back to the sky quickly after sunset, so a blistering day can turn into a near-freezing night \u2014 one of the desert's signatures.",
      alpine: "High in the mountains the thin air filters out less sunlight, so ultraviolet rays grow stronger with every step up in elevation. Alpine life must endure this intense UV while also surviving freeze-thaw cycles, where the ground thaws by day and refreezes by night, constantly churning the soil and challenging plant roots.",
      coastal: "When the tide pulls back on a clear, sunny day, tidepool creatures like barnacles, limpets, and mussels are left exposed to bake in the open air. They face both overheating and drying out, and are specially built to endure the twice-daily swing between being underwater and sun-baked.",
      meadow: "Many prairie grasses are sun-lovers, using an extra-efficient form of photosynthesis (called C4) that works best in hot, bright conditions, peaking around 90-95 degrees. The grasses are mostly wind-pollinated, but the wildflowers scattered among them draw busy bees and butterflies on sunny days."
    },
    cloudy: {
      _default: "Overcast skies soften the day, lowering the sun's intensity and slowing how fast soil and surfaces dry out. The cooler, calmer conditions ease heat stress on plants and animals, and the steady grey light keeps the whole landscape ticking along at a gentler pace."
    },
    rain: {
      _default: "Rain is the great refresher, soaking the soil and waking up roots, seeds, and the countless small lives that depend on moisture. After a good rain many plants green up quickly and decomposition speeds back up, recycling nutrients into the ground.",
      desert: "A desert rain can transform the land almost overnight. Water soaks dormant seeds and triggers bursts of short-lived 'ephemeral' wildflowers, while spadefoot toads, cued by the vibration of falling rain, dig up from underground where they've waited for months. They rush to temporary pools to breed in loud choruses, and because the pools dry fast, their tadpoles race to transform in record time.",
      wetland: "A marsh runs on rain, which sets its 'hydroperiod' \u2014 the stretch of time the wetland stays wet. That timing largely decides which frogs and salamanders can breed there, since their larvae need the water to last long enough to grow up. A good rainy spell can fill a marsh just long enough for a whole new generation to develop.",
      forest: "Rain brings the forest's quiet recyclers to life. Mushrooms \u2014 the fruiting bodies of fungi \u2014 pop up after wet weather, while underground a lace-like web of fungal threads spreads through the soil and dead wood, breaking fallen leaves and logs into fertile earth and even linking tree roots into a sharing network.",
      meadow: "Grasslands respond fast to rain, since how much a meadow grows is tightly tied to how much it rains. After a soaking the grasses green up and shoot upward quickly, and the timing of rain through the season shapes how lush the whole meadow becomes."
    },
    storm: {
      _default: "Storms bring wind and heavy rain that knock things down and stir things up \u2014 but this disturbance is a natural, even healthy part of how wild places work. Storms reshape the land, clear away the old, and open room for new growth.",
      forest: "Wind is the leading cause of 'treefall gaps' \u2014 the openings left when a storm topples one or more trees. Each gap lets a sudden burst of sunlight reach the shaded floor, sparking a flush of new seedlings, which keeps the woodland varied in age and full of opportunity.",
      coastal: "Storm waves rip giant kelp off the seafloor and fling it ashore as 'wrack,' which fuels the entire sandy-beach food web \u2014 roughly 40% of beach invertebrates depend on it. Beach hoppers and kelp flies feed on the wrack, and they in turn feed shorebirds; on rocky shores those same waves overturn boulders and open fresh space that resets the community.",
      desert: "In the Sonoran Desert, summer's monsoon brings booming afternoon thunderstorms that ease the heat but create its most dangerous weather. Hard rain runs off the sun-baked ground into normally dry creek beds \u2014 arroyos, or washes \u2014 which can fill with fast, deadly floodwater in under a minute, sometimes while the storm is still miles away.",
      wetland: "Wetlands act like natural sponges. During a big storm a marsh swells, soaking up the rush of rain and floodwater and then releasing it slowly, which lowers the flood peak and protects the land downstream.",
      alpine: "In the mountains, thunderstorms tend to build in the early afternoon, which makes the open ground above the treeline especially dangerous \u2014 there's nothing tall to draw the lightning away. Hikers are urged to reach high summits early and head back down before noon."
    },
    fog: {
      _default: "Fog is really a cloud resting at ground level, formed when moist air cools until its water vapor condenses into countless tiny floating droplets. For many plants it is a gift of moisture, settling onto leaves and soil even when no rain falls.",
      forest: "When fog drifts through a forest, the leaves, branches, and the mosses and lichens clinging to them comb tiny droplets from the air. The droplets merge and fall like a slow rain \u2014 'fog drip' \u2014 watering the understory, which is why mosses, ferns, and lichens drape so thickly over the trunks.",
      coastal: "Fog defines many seashores, forming where the ocean's moist air meets cooler air and drifts inland as a marine layer. It brings welcome moisture and shade that ease summer's hot, dry stress \u2014 genuine relief for creatures stranded above the water at low tide, who face the greatest danger on cloudless, sun-baked days.",
      wetland: "A marsh sits under a near-constant blanket of moisture, so on calm, cool nights it readily forms fog and heavy dew as the humid air over the water saturates. This can be a real extra source of water for plants at the water's edge, keeping the wetland damp between rains."
    },
    snow: {
      _default: "A blanket of snow doesn't just cover the land \u2014 it insulates it. Deep snow traps heat rising from the soil, creating a hidden, sheltered world at ground level called the subnivean zone, a humid space that stays remarkably steady around 32 degrees even when the air above is bitter. Mice, voles, and shrews stay active down there all winter.",
      alpine: "Mountain snowpack is a natural water tower, storing winter's snow and releasing it slowly as it melts through spring and summer, feeding streams when water is needed most \u2014 in the Colorado River Basin, 70-85% of the year's runoff begins as mountain snow. Beneath the deep snow, the insulated subnivean space lets small mammals like pikas survive the cold.",
      forest: "Snow piling on branches adds weight that can bend or snap limbs \u2014 a strain called snow load. But on the ground that same snow becomes a cozy blanket, insulating the soil and the roots, seeds, and creatures sheltering beneath it from the deep freeze above."
    },
    heat: {
      _default: "During a hot, dry spell, plants lose precious water to the air through their leaves (transpiration, which also cools them like sweating) and may wilt or pause growth to conserve it. Many animals turn crepuscular \u2014 active at dawn and dusk \u2014 while sheltering in burrows or shade through the scorching midday.",
      desert: "Desert life is the master of heat and drought. Cacti store water in fleshy stems, spread shallow roots to grab rain fast, and open their pores only at night to lose less water; a big barrel cactus can last over a year without rain. Some animals enter estivation, a summer version of hibernation, to wait out the worst.",
      wetland: "As a marsh dries down in heat, the shrinking water crowds fish, crayfish, and other prey into shallow pools \u2014 easy buffets for wading birds like wood storks and ibises. Many wetlands are meant to rise and fall this way; these flood-and-dry cycles are a healthy part of marsh life.",
      coastal: "On hot days, animals exposed at low tide can face air far warmer than the seawater they're used to. Stranded between tides under a strong sun, mussels, limpets, and barnacles risk overheating and drying out, and an extreme heat spell during a midday low tide can trigger die-offs.",
      meadow: "Grasslands are built for drought. Deep, dense roots and stored soil moisture let warm-season grasses endure hot, dry summers, and when the moisture runs out they simply go dormant, pausing aboveground growth and pulling resources down to their roots \u2014 then spring back when the rains return.",
      forest: "In a heat wave, trees lose water through their leaves faster than their roots can replace it, so they wilt their foliage or close their leaf pores to ration moisture, slowing growth. The deep shade beneath a full canopy offers a cool refuge, often many degrees cooler than open ground."
    }
  },
  seasonEffects: {
    _comment: "How each season shapes life in a biome, grounded in the same credible sources. Shown in the weather menu for the biome you're standing in. `_default` applies unless a biome-specific line is given.",
    spring: {
      _default: "Spring brings the 'green wave' of fresh growth sweeping across the land, and with it a flush of waking insects. Migrating birds time their return to this bounty, arriving to breed just as food becomes plentiful, while pollinators emerge to visit the first flowers.",
      desert: "In the desert, spring is the season of the 'superbloom,' when an unusually wet, well-timed winter wakes thousands of dormant seeds that burst into flower at once. The winter rains must be generous enough to carry the plants through blooming; sudden heat or wind can cut the display short.",
      forest: "On the forest floor, 'spring ephemerals' race to grow, bloom, and set seed in the brief window before the trees leaf out and steal the sunlight. Many capture most of their whole year's energy in these few sunny weeks, feeding the first hungry bees before the canopy closes.",
      wetland: "As snowmelt and rain refill the marsh, frogs and toads emerge to breed in a noisy spring chorus \u2014 some species gathering for just a few frantic days. The wet meadows become vital rest stops for waterfowl and shorebirds migrating north.",
      alpine: "Spring comes late and slowly to the high country. Deep snow can linger well into the warm season, and as long as it lasts it holds the plants back, delaying green-up \u2014 which is why the peaks look wintry while the valleys below have already turned green.",
      meadow: "As warmth and rain arrive, the meadow greens up and the earliest wildflowers bloom, drawing out pollinators. Ground-nesting birds like bobolinks and meadowlarks build their nests right in the grass, while emerging insects feed the next generation."
    },
    summer: {
      _default: "Summer is the season of fullest growth, when long days and warmth push plants to their peak and the landscape brims with life. It is also the season of heat, when plants and animals alike must work to keep cool and hold onto water.",
      alpine: "Above the treeline the growing season is breathtakingly short, so alpine wildflowers must sprout, bloom, and set seed in just a few weeks, many growing as low, dense 'cushions' that hug the ground against the wind. Pikas spend summer gathering grasses into 'haypiles' among the rocks to eat through winter.",
      forest: "In summer the leafy canopy is fully closed, and the shaded understory may get less than a tenth of the sunlight hitting the treetops. With light so scarce below, understory plants compete hard for what filters through \u2014 exactly why the spring wildflowers finished early.",
      meadow: "Summer is the meadow's peak, when grasses grow tallest and set seed and wildflowers reach full bloom. Grasslands are also shaped by fire and wonderfully adapted to it: the growing points of many prairie plants sit safely underground, letting them resprout quickly \u2014 often more vigorously \u2014 after a burn.",
      coastal: "Summer is nesting season on the shore. The threatened western snowy plover nests from about March through September, laying eggs in simple scrapes right on the open sand, camouflaged with shell and driftwood. Because the nests are so easy to step on, many beaches set up protected zones.",
      desert: "In the Sonoran Desert, summer means the monsoon, when afternoon thunderstorms roll in to break the heat. The hard rains revive the parched land but also run off the baked ground into washes that can flood in an instant \u2014 the most dramatic season in the desert calendar."
    },
    autumn: {
      _default: "Autumn is the season of letting go and storing up. Plants senesce, drawing nutrients back into their roots and stems before winter, while many animals migrate or busily gather and cache food for the cold months ahead.",
      forest: "Autumn's blaze of color is active, not just withering: trees pull chlorophyll back out of their leaves, and as the green fades the hidden yellows and oranges shine through while fresh reds are newly made. Many oaks have 'mast years,' dropping huge synchronized acorn crops that squirrels, jays, and chipmunks bury \u2014 a good acorn year often decides who survives winter.",
      meadow: "In autumn the grasses turn golden and slip toward dormancy, having scattered their seeds. On the open prairie the wind is a great seed-spreader, carrying lightweight, sometimes plumed or winged seeds far from the parent plant to take root in new ground."
    },
    winter: {
      _default: "Winter pushes life into dormancy and rest. Many animals hibernate or enter torpor, deliberately dropping their body temperature and slowing their metabolism to save energy when food is scarce; true hibernators like ground squirrels can cool dramatically, while bears merely sleep lightly and are easily roused.",
      forest: "Deciduous trees survive winter by dropping their leaves and shutting down photosynthesis, first reclaiming their sugars into trunk and roots; shedding those freeze-vulnerable leaves protects the tree. Evergreen conifers keep waxy needles to limit water loss but mostly pause too, while animals that didn't migrate hibernate or live off autumn's caches.",
      wetland: "When winter freezes the marsh into ice, cold-blooded amphibians go dormant. Aquatic frogs settle near the bottom and breathe through their skin, while wood frogs and spring peepers can survive freezing nearly solid by making a natural antifreeze in their cells. Most waterfowl move on once open water grows scarce.",
      alpine: "High-mountain animals face winter in different ways. Marmots hibernate deep in their burrows on summer fat, while pikas don't hibernate at all \u2014 they stay active beneath the snow on the haypiles they stored, relying on the insulating snowpack against the bitter wind. Both depend on snow, so their numbers rise and fall with each winter's snowfall.",
      meadow: "In winter the visible grass dies back, but the plants are far from dead. Prairie plants store life in vast root systems reaching as deep as several meters, along with underground crowns. These hidden growing points let the meadow ride out the cold and burst back when warmth returns.",
      coastal: "Winter brings the strongest storms and biggest waves of the year to the coast. They tear loose great rafts of kelp and cast them ashore as wrack, a seasonal feast for sand-dwelling creatures and the shorebirds that eat them, while the heavy surf overturns rocks and refreshes the intertidal community."
    }
  },
  seasonStyle: {
    _comment: "tint = ground color the biome lerps toward; accent = HUD chip color; label = display name.",
    spring: { label: "Spring", tint: "#a9d77a", tintAmount: 0.12, accent: "#8fc46a" },
    summer: { label: "Summer", tint: "#c7d96a", tintAmount: 0.1, accent: "#cdbb4e" },
    autumn: { label: "Autumn", tint: "#d99a52", tintAmount: 0.22, accent: "#d4863c" },
    winter: { label: "Winter", tint: "#cdd6e0", tintAmount: 0.28, accent: "#9fb4c9" }
  },
  dayPhaseStyle: {
    _comment: "Lighting overlay: `color`/`alpha` = uniform full-screen tint (used for the night dim + a light warm ground wash at dawn/dusk). `sky` = optional warm gradient concentrated at the TOP of the view (dawn/dusk sunset glow) so a strong sunset doesn't brown the whole ground. day is clear; night dim & cool.",
    dawn: { label: "Dawn", color: "#ffcaa0", alpha: 0.07, sky: { color: "#ffb478", alpha: 0.3 } },
    day: { label: "Day", color: "#ffffff", alpha: 0 },
    dusk: { label: "Dusk", color: "#f0b09a", alpha: 0.07, sky: { color: "#ff9152", alpha: 0.42 } },
    night: { label: "Night", color: "#070b1c", alpha: 0.66 }
  },
  types: {
    clear: { name: "Clear", icon: "sun", tags: [], growthMult: 1, waterPerDay: 0, flavor: "Open sky and easy light.", particle: null, overlay: null },
    cloudy: { name: "Cloudy", icon: "cloud", tags: [], growthMult: 1, waterPerDay: 0, flavor: "A soft grey lid over the preserve.", particle: null, overlay: { color: "#9aa6ad", alpha: 0.14 } },
    rain: { name: "Rain", icon: "drop", tags: ["wet"], growthMult: 1.25, waterPerDay: 4, flavor: "Steady rain \u2014 the ground drinks it in.", particle: "rain", overlay: { color: "#5d6f86", alpha: 0.2 } },
    storm: { name: "Storm", icon: "drop", tags: ["wet", "harsh"], growthMult: 1.1, waterPerDay: 6, flavor: "Wind and heavy rain sweep through.", particle: "rain", overlay: { color: "#3f4a63", alpha: 0.34 } },
    fog: { name: "Fog", icon: "cloud", tags: [], growthMult: 1, waterPerDay: 1, flavor: "Mist softens every edge.", particle: null, overlay: { color: "#d7dde0", alpha: 0.3 } },
    snow: { name: "Snow", icon: "sparkle", tags: ["cold"], growthMult: 0.9, waterPerDay: 1, flavor: "Quiet snow settles over the slope.", particle: "snow", overlay: { color: "#cdd9e6", alpha: 0.16 } },
    heat: { name: "Dry Heat", icon: "sun", tags: ["harsh", "dry"], growthMult: 1, waterPerDay: -3, flavor: "Hot and dry \u2014 beds lose their moisture.", particle: null, overlay: { color: "#ffca7a", alpha: 0.12 } }
  },
  feed: {
    _comment: "Retention hook: when a biome's weather CHANGES, one of these lines is surfaced in the activity feed. `onArrive` fires when the player is present as it starts; `overnight` is the login summary for weather that passed while they were away (Phase 4 wiring). Multiple lines per key so repeat visits stay fresh.",
    clear: {
      icon: "sun",
      onArrive: ["The clouds break and sun pours over the preserve.", "Skies clear \u2014 a bright, easy day settles in.", "The last cloud slips away; warmth spreads across the grass.", "Sunlight finds the meadow again and the birds pick up.", "Blue sky returns, clean and wide over the preserve."],
      overnight: ["You wake to clear skies over the preserve.", "Morning breaks bright and cloudless."]
    },
    cloudy: {
      icon: "cloud",
      onArrive: ["A soft grey lid slides over the sky.", "Clouds gather, gentle and cool.", "The light goes flat and silver as cloud rolls in.", "A cool overcast settles \u2014 the colours go quiet."],
      overnight: ["A quiet, overcast morning.", "You arrive under a low grey sky."]
    },
    rain: {
      icon: "drop",
      onArrive: ["Rain begins to fall \u2014 your soil beds drink it in.", "A steady rain moves through. The watered ground deepens.", "First drops, then a steady patter. The preserve greens a little.", "Rain taps across the leaves; the whole preserve smells of wet earth.", "A gentle downpour settles in \u2014 puddles gather along the paths."],
      overnight: ["Rain passed through overnight \u2014 your beds woke up watered.", "You return to rain-fed soil; the ground recovered while you were away.", "Overnight rain left every leaf beaded and bright."]
    },
    storm: {
      icon: "drop",
      onArrive: ["A storm rolls in \u2014 wind, then heavy rain.", "Thunder in the distance; the rain comes down hard.", "The sky darkens fast and the wind bends the grass flat.", "Lightning flickers over the ridge \u2014 best stay close to camp.", "A real storm breaks: sheeting rain, rattling branches."],
      overnight: ["A storm swept through while you were gone. The ground is soaked.", "You return to snapped twigs and standing water \u2014 a storm had passed."]
    },
    fog: {
      icon: "cloud",
      onArrive: ["Mist rises and softens every edge of the preserve.", "Fog settles in, hushing the morning.", "A thick fog rolls through; shapes blur a few steps out.", "The world goes quiet and white as fog drifts across the ground."],
      overnight: ["You arrive to a preserve wrapped in fog.", "Morning fog hangs low between the trees."]
    },
    snow: {
      icon: "sparkle",
      onArrive: ["Snow begins to fall, quiet and slow.", "The first flakes settle over the slope.", "Snow drifts down in fat, lazy flakes and the world hushes.", "A clean white layer creeps across the ground as snow falls."],
      overnight: ["Snow fell overnight \u2014 the preserve is dusted white.", "You wake to fresh snow and a hush over everything."]
    },
    heat: {
      icon: "sun",
      onArrive: ["The air turns hot and dry \u2014 keep an eye on your beds.", "Dry heat builds; the soil will want watering.", "A heat haze shimmers over the ground \u2014 the beds will go thirsty.", "The sun beats down hard and the earth starts to crack and dry."],
      overnight: ["A dry, hot spell set in while you were away \u2014 some beds have dried out.", "You return to parched, dusty ground after a hot stretch."]
    },
    season: {
      icon: "sparkle",
      spring: ["Spring arrives. New growth stirs across the preserve.", "Spring greens the ground and the first buds open."],
      summer: ["Summer settles in, long and bright.", "Summer arrives \u2014 the days stretch long and warm."],
      autumn: ["Autumn turns the preserve gold and amber.", "Autumn arrives; the leaves begin to turn and drift."],
      winter: ["Winter comes quiet and cold to the preserve.", "Winter settles in \u2014 still, cold, and bright."]
    }
  },
  climate: {
    default: {
      spring: { clear: 4, cloudy: 3, rain: 3, fog: 1 },
      summer: { clear: 6, cloudy: 2, rain: 2, storm: 1 },
      autumn: { clear: 3, cloudy: 4, rain: 2, fog: 2 },
      winter: { clear: 3, cloudy: 3, rain: 1, snow: 2, fog: 1 }
    },
    meadow: {
      spring: { clear: 4, cloudy: 3, rain: 3 },
      summer: { clear: 6, cloudy: 2, rain: 1, storm: 1 },
      autumn: { clear: 3, cloudy: 4, rain: 2, fog: 1 },
      winter: { clear: 3, cloudy: 3, rain: 1, snow: 1, fog: 1 }
    },
    forest: {
      spring: { clear: 3, cloudy: 3, rain: 3, fog: 2 },
      summer: { clear: 4, cloudy: 3, rain: 2, storm: 1, fog: 1 },
      autumn: { clear: 2, cloudy: 4, rain: 3, fog: 3 },
      winter: { clear: 2, cloudy: 4, rain: 1, snow: 2, fog: 2 }
    },
    wetland: {
      spring: { cloudy: 3, rain: 4, storm: 1, fog: 2 },
      summer: { clear: 2, cloudy: 3, rain: 4, storm: 2, fog: 1 },
      autumn: { cloudy: 4, rain: 4, fog: 3 },
      winter: { cloudy: 3, rain: 3, snow: 1, fog: 3 }
    },
    desert: {
      spring: { clear: 6, heat: 3, cloudy: 1, rain: 1 },
      summer: { clear: 5, heat: 6, storm: 1 },
      autumn: { clear: 6, heat: 3, cloudy: 1 },
      winter: { clear: 6, heat: 1, cloudy: 2, rain: 1 }
    },
    alpine: {
      spring: { clear: 3, cloudy: 3, rain: 2, snow: 2, fog: 1 },
      summer: { clear: 4, cloudy: 3, rain: 2, storm: 1 },
      autumn: { clear: 2, cloudy: 3, snow: 3, fog: 2 },
      winter: { clear: 1, cloudy: 2, snow: 6, fog: 2 }
    },
    coastal: {
      spring: { clear: 3, cloudy: 3, rain: 2, fog: 3, storm: 1 },
      summer: { clear: 5, cloudy: 3, fog: 2, storm: 1 },
      autumn: { clear: 2, cloudy: 4, rain: 2, fog: 3, storm: 1 },
      winter: { cloudy: 3, rain: 3, fog: 3, storm: 2 }
    }
  }
};

// server/weather.ts
var MINUTE = 6e4;
var CFG = weather_default.config;
var DAY_MS = Number(CFG?.dayMs) || 24 * MINUTE;
var DAYS_PER_SEASON = Number(CFG?.daysPerSeason) || 3;
var SEASONS = weather_default.seasons || ["spring", "summer", "autumn", "winter"];
var DAY_PHASES = CFG?.dayPhases || [
  { id: "dawn", until: 0.15 },
  { id: "day", until: 0.6 },
  { id: "dusk", until: 0.72 },
  { id: "night", until: 1 }
];
var CLIMATE = weather_default.climate;
var GATHER = Object.fromEntries(
  Object.entries(weather_default.gather || {}).filter(([k, v]) => k !== "_comment" && v !== null && typeof v === "object")
);
function gatherResourceIdFor(biome, type) {
  return GATHER[biome]?.[type];
}
function isWeatherGatheredResource(id) {
  for (const biome of Object.keys(GATHER)) {
    for (const t2 of Object.keys(GATHER[biome])) if (GATHER[biome][t2] === id) return true;
  }
  return false;
}
function fnv1a(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = a + 1831565813 | 0;
    let t2 = Math.imul(a ^ a >>> 15, 1 | a);
    t2 = t2 + Math.imul(t2 ^ t2 >>> 7, 61 | t2) ^ t2;
    return ((t2 ^ t2 >>> 14) >>> 0) / 4294967296;
  };
}
function pickWeighted(weights, rng) {
  const keys = Object.keys(weights);
  if (keys.length === 0) return "clear";
  let total = 0;
  for (const k of keys) total += Math.max(0, weights[k]);
  if (total <= 0) return keys[0];
  let r = rng() * total;
  for (const k of keys) {
    r -= Math.max(0, weights[k]);
    if (r < 0) return k;
  }
  return keys[keys.length - 1];
}
function dayIndexAt(t2) {
  return Math.floor(t2 / DAY_MS);
}
function dayProgressAt(t2) {
  const m = t2 % DAY_MS;
  return (m < 0 ? m + DAY_MS : m) / DAY_MS;
}
function dayStartAt(t2) {
  return dayIndexAt(t2) * DAY_MS;
}
function dayPhaseAt(t2) {
  const p = dayProgressAt(t2);
  for (const ph of DAY_PHASES) if (p < ph.until) return ph.id;
  return DAY_PHASES[DAY_PHASES.length - 1].id;
}
function nextPhaseAt(t2, phaseId) {
  let start = 0;
  for (let i = 0; i < DAY_PHASES.length; i++) {
    if (DAY_PHASES[i].id === phaseId) {
      start = i === 0 ? 0 : DAY_PHASES[i - 1].until;
      break;
    }
  }
  const target = dayStartAt(t2) + start * DAY_MS;
  return target > t2 ? target : target + DAY_MS;
}
function nextDawnAt(t2) {
  return nextPhaseAt(t2, "dawn");
}
function seasonAt(t2) {
  const day = dayIndexAt(t2);
  const idx = Math.floor(day / DAYS_PER_SEASON) % SEASONS.length;
  return SEASONS[(idx + SEASONS.length) % SEASONS.length];
}
function weatherTypeAt(worldId, biomeId, t2) {
  const day = dayIndexAt(t2);
  const season = seasonAt(t2);
  const perBiome = CLIMATE[biomeId] || CLIMATE.default;
  const weights = perBiome && perBiome[season] || CLIMATE.default && CLIMATE.default[season] || { clear: 1 };
  const rng = mulberry32(fnv1a(`${worldId}:${biomeId}:${day}`));
  return pickWeighted(weights, rng);
}
var WEATHER_TYPES = Object.keys(weather_default.types || {});
function weatherSnapshot(worldId, t2, biomeIds, override) {
  const since = dayStartAt(t2);
  const forcedType = override?.type || null;
  const forcedSeason = override?.season || null;
  const byBiome = {};
  for (const id of biomeIds) byBiome[id] = { type: forcedType || weatherTypeAt(worldId, id, t2), since };
  const snap = {
    season: forcedSeason || seasonAt(t2),
    dayPhase: dayPhaseAt(t2),
    dayProgress: dayProgressAt(t2),
    dayIndex: dayIndexAt(t2),
    dayMs: DAY_MS,
    byBiome
  };
  if (forcedType || forcedSeason) snap.override = { type: forcedType, season: forcedSeason };
  return snap;
}

// src/i18n/en/server.json
var server_default = {
  _readme: "Server-side strings that reach players: GameError messages, server-authored feed/flavor text (server/resources.ts). Keys are referenced as server.<key>.",
  err: {
    dbStarting: "The preserve database is starting up \u2014 restart Harper if this persists.",
    positiveWholeNumber: "{label} must be a positive whole number",
    playerIdRequired: "playerId required",
    noSaveLogin: "No save found \u2014 please log in again",
    unknownBiome: "Unknown biome: {biome}",
    notEnough: "Not enough {resource}: need {need}, have {have} (basket + chests)",
    notEnoughShort: "Not enough {resource}",
    bodyRequired: "Request body required",
    nameLength: "Pick a name between 2 and 24 characters",
    passcodeLength: "Pick a passcode of at least 4 characters",
    nameNeedsAlnum: "That name needs at least one letter or number",
    saveExists: "A save with that name already exists",
    noSaveWithName: "No save found with that name",
    passcodeMismatch: "That passcode doesn't match this save",
    newPasscodeLength: "Pick a new passcode between 4 and 32 characters",
    noSaveTryNew: "No save found with that name \u2014 try New Game",
    worldNameLength: "Pick a world name under 40 characters",
    noWorldWithCode: "No world found with that code",
    hostNotApproved: "The host hasn\u2019t approved you for this world yet",
    worldFullJoined: "This preserve is full \u2014 {max} caretakers have joined and it's closed to new players.",
    missingToken: "Missing request token",
    worldFullClosed: "This preserve is full \u2014 it already has its {max} caretakers and is closed to new players.",
    noCoopWorld: "No such co-op world",
    onlyHostApproves: "Only the host can approve players",
    requestNotPending: "That request is no longer pending",
    notWorldMember: "You are not a member of that world",
    cannotLeaveSolo: "You cannot leave your own solo world",
    notInWorld: "You are not in that world",
    biomeLocked: "{biome} is not unlocked yet",
    unknownResource: "Unknown resource: {resource}",
    weatherOnly: "{resource} only appears in certain weather here",
    resourceNotInBiome: "{resource} is not found in {biome}",
    nodeIdRequired: "nodeId required",
    regrowing: "This spot is still regrowing \u2014 come back soon",
    basketFullStore: "Your basket is full \u2014 store materials in a chest first",
    chestNotFound: "Chest not found",
    notEnoughInBasket: "Not enough {resource} in your inventory",
    chestFull: "That chest is full",
    notEnoughInChest: "Not enough {resource} in that chest",
    basketFull: "Your basket is full",
    badDirection: "direction must be 'deposit' or 'withdraw'",
    idRequired: "id required",
    discardTooMany: "You do not have that many to throw away",
    unknownRecipe: "Unknown recipe: {recipe}",
    plantedNotCrafted: "{name} is planted, not crafted \u2014 dig a bed, water it, and plant it.",
    needsProperHouse: "{name} needs a proper house \u2014 upgrade your home's Space first.",
    recipeBiomeLocked: "This recipe unlocks with a biome you have not restored yet",
    recipeLocked: "Not unlocked yet \u2014 {label}.",
    requiresUpgradedTool: "Requires the upgraded {tool}",
    craftOnce: "You have already crafted the {name} \u2014 it only needs to be made once.",
    unknownObject: "Unknown object: {object}",
    kitNotPlaceable: "{name} is a kit, not a placeable object",
    noneCrafted: "You have no crafted {name} to place",
    outOfReach: "That spot is out of reach",
    outdoorOnly: "{name} belongs out in the preserve, not indoors",
    needsBiggerHome: "{name} needs a bigger home \u2014 upgrade your home's Space first.",
    placeOnFloor: "Place it on the floor inside your home",
    unknownArea: "Unknown area: {area}",
    indoorOnly: "{name} cannot be placed out in the preserve",
    wrongHabitat: "{name} does not suit the {biome} habitat",
    openOcean: "That is open ocean \u2014 build on the shore",
    placeRequiresTool: "Placing {name} requires an upgraded {tool}",
    spotTaken: "That spot is already taken",
    openWaterBridge: "That is open water \u2014 a wooden bridge can span it",
    bedForPlanting: "That soil bed is for planting \u2014 or clear it with the shovel",
    bridgeNeedsWater: "Bridges go over open water \u2014 flood a channel first",
    notPlantable: "That cannot be planted",
    wouldNotTakeRoot: "{name} would not take root in the {biome}",
    plantIntoWatered: "Plant into a watered soil bed \u2014 dig with the shovel, then water it",
    placementNotFound: "Placement not found",
    notHarvestable: "There's nothing to harvest from that",
    notReadyYet: "Not ready to harvest yet \u2014 give it time to grow back",
    basketFullHarvest: "Your basket is full \u2014 make room before harvesting",
    workbenchStays: "Your crafting station stays put \u2014 the preserve needs it",
    openWaterBridgeOnly: "That is open water \u2014 only a bridge can sit there",
    bedForPlantingShort: "That soil bed is for planting",
    bridgesOverWater: "Bridges go over open water",
    emptyChestFirst: "Empty the chest before picking it up",
    noRoomRefund: "No room for the refunded materials \u2014 make space in your basket or a chest first",
    unknownTool: "Unknown tool: {tool}",
    toolMaxed: "{tool} is already fully upgraded",
    restoreFirst: "Restore {biome} to {health}% health first",
    unknownHomeUpgrade: "Unknown home upgrade",
    buildStyleFirst: "Build your home in a style first.",
    trackMaxed: "Your home's {track} is already at its finest.",
    needBedToRest: "Craft and place a sleeping bag or bed in your home first.",
    buildBeforeRepaint: "Build your home before you can repaint it.",
    buildBeforeRepaintThings: "Build your home before you can repaint your things.",
    invalidColor: "Invalid color",
    itemNotHere: "That item is not here",
    unknownHomeStyle: "Unknown home style",
    homeAlreadyBuilt: "Your home is already built \u2014 choose upgrades from here.",
    animalNotReturned: "That animal has not returned yet",
    taskNotOnBoard: "That task is not on today's board",
    taskAlreadyClaimed: "Already claimed \u2014 fresh tasks arrive tomorrow",
    taskNotClaimable: "That's a guidance goal \u2014 it tracks progress but isn't claimed",
    taskNotFinished: "Not finished yet \u2014 check the board for what remains",
    basketFullReward: "Your basket is full \u2014 make room for the reward first",
    terraformOutdoors: "You can only shape the ground out in the preserve",
    somethingPlaced: "Something is already placed there",
    needShovel: "You need your shovel for that",
    alreadyPrepared: "This ground is already prepared \u2014 water it, or clear it instead",
    needWateringCan: "You need your watering can for that",
    prepareBedFirst: "Prepare a soil bed with your shovel first",
    alreadyOpenWater: "This is already open water",
    tooDryToFlood: "{biome} is too dry to flood \u2014 soil beds here can only be readied for planting.",
    needWater: "You need {count} water for that \u2014 gather more first",
    nothingToClear: "Nothing to clear here",
    badTerraformAction: "action must be 'dig', 'water', or 'clear'",
    notExplorable: "{biome} is part of the preserve plan but not explorable yet",
    noSaveWithId: "No save found with that id",
    snapshotPathId: "Add a player id to the path: /BiomeSnapshot/<playerId>",
    meadowCannotLock: "The starting meadow cannot be locked",
    unknownAnimal: "Unknown animal: {animal}",
    cannotPopulate: "Cannot populate {area}",
    noPlaceableObjects: "No placeable objects exist for {biome}",
    unknownWeatherType: "Unknown weather type: {type}",
    unknownSeason: "Unknown season: {season}",
    unknownDevAction: "Unknown dev action: {action}",
    feedbackEmpty: "Please write a little something first",
    feedbackTooLong: "Feedback is limited to {max} characters",
    feedbackBadEmail: "That reply email doesn\u2019t look right \u2014 leave it blank if you don\u2019t want a response",
    clientIdRequired: "clientId required",
    snapshotRequired: "snapshot required",
    snapshotTooLarge: "snapshot too large"
  },
  task: {
    welcomeGrasshopper: "Welcome the grasshopper home",
    welcomeGrasshopperHint: "Craft and place a grass patch, then bring the meadow to 10% health \u2014 the grasshopper hops home on its own.",
    raiseHealth: "Raise {biome}'s health from {current}% to {goal}%",
    welcomeNewAnimal: "Welcome a new animal back to {biome}",
    welcomeAnyAnimal: "Welcome a new animal, anywhere in the preserve",
    craftKit: "Craft a {item}",
    gather: "Gather {count}\xD7 {resource}",
    craft: {
      one: "Craft {count} item",
      other: "Craft {count} items"
    },
    place: {
      one: "Place {count} crafted thing",
      other: "Place {count} crafted things"
    },
    water: "Water {count} soil beds",
    plantBeds: "Plant 2 seedlings in watered beds",
    observe: "Read about 3 animals in your journal",
    collectSeeds: "Gather 12 seeds",
    gatherHint: "Select your basket (1), walk onto a glowing spot on the ground, and press E or Space.",
    plantThree: "Plant 3 seedlings",
    craftFirst: "Craft your first habitat",
    craftFirstHint: "Open crafting (C), pick something you can afford, and press Craft."
  },
  goal: {
    craft: "Craft {count}\xD7 {item}",
    build: "Craft and place {count}\xD7 {item}",
    grow: "Plant {count}\xD7 {item}",
    plant: "Plant {count} things",
    collect: "Collect {count}\xD7 {resource}",
    observe: "Read about {count} animals",
    welcome: "Bring back the {animal}",
    attract: "Attract a mystery {kind}",
    welcomeTotal: "Welcome {count} animals to the preserve",
    creature: "creature",
    habitatStep: "{have}/{need} {name}",
    healthStep: "Biome health {cur}/{need}%",
    matStep: "{have}/{need} {name}",
    home: "Upgrade your home's {track} to level {level}",
    buildHome: "Build your home: {style}",
    aHouse: "a house",
    unlock: "Unlock {biome}",
    track: {
      space: "space",
      comfort: "comfort",
      decor: "decor",
      light: "light"
    },
    hint: {
      craft: "Open crafting (C) and make it \u2014 the hover box lists the materials it needs.",
      build: "Craft it (C), then place it out in the biome from the 'ready to place' bar.",
      grow: "Dig a bed (2), water it (3), then plant it from the bed's menu.",
      plant: "Dig a bed with the shovel, water it, then plant something living.",
      collect: "Gather this material from glowing spots out in the preserve.",
      observe: "Open an animal's entry in your field journal (J) to read about it.",
      welcome: "Build the habitat it needs \u2014 it returns on its own.",
      attract: "Build the habitat in the info box; the animal comes back on its own.",
      welcomeTotal: "Restore habitat across your biomes \u2014 animals return on their own.",
      home: "Use the sign by your camp tent to upgrade your home.",
      unlock: "Meet the requirements shown to open this biome.",
      health: "Heal the land \u2014 plant, water, and place habitat until this biome recovers.",
      biomeAnimals: "Build every animal's habitat here until the whole biome is home."
    },
    restore: "Restore {biome} to {pct}% health",
    biomeAnimals: "Welcome all {count} animals to {biome}",
    upgradeGuide: "Upgrade your field guide (Tools) to reveal exactly what it needs."
  },
  nextbiome: {
    title: "Unlock {biome}",
    hint: "Tick off each requirement below to open {biome}.",
    health: "{biome} at {goal}% health ({cur}% now)",
    animals: "{goal} animals back in {biome} ({cur} now)",
    total: "{goal} animals across the preserve ({cur} now)",
    craft: "Craft a {item}"
  },
  unlockreward: {
    title: "{biome} unlocked!\nClaim your welcome bundle",
    hint: "A handful of {biome} materials to get you started there."
  },
  feed: {
    joinedWorld: "{name} joined the preserve!"
  },
  world: {
    soloName: "{name} preserve",
    mySoloName: "My preserve",
    coopName: "{name}'s preserve"
  },
  fallback: {
    host: "the host",
    caretaker: "caretaker",
    newCaretaker: "A caretaker"
  },
  whyReturned: {
    sentence: "Felt safe enough to return once {reasons}.",
    objectQty: "{qty}\xD7 {name}",
    habitat: "habitat in place ({objects})",
    lake: "a lake of {tiles}+ open-water tiles",
    river: "a river {tiles}+ tiles long",
    tiles: "{tiles}+ open-water tiles",
    health: "biome health reached {health}%",
    balance: "ecological balance reached {balance}%",
    animals: "{animals} had already returned",
    inSeason: "in {seasons}",
    atPhase: "at {phases}",
    moment: "the moment was right ({conditions})"
  },
  list: {
    comma: ", ",
    and: " and ",
    or: " or "
  }
};

// src/i18n/core.ts
var FALLBACK_LOCALE = "en";
var catalogs = /* @__PURE__ */ new Map();
var activeLocale = FALLBACK_LOCALE;
function flatten(src, prefix, out) {
  for (const [k, v] of Object.entries(src)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string" || Array.isArray(v)) {
      out[key] = v;
    } else if (v && typeof v === "object") {
      const o = v;
      if (typeof o.one === "string" && typeof o.other === "string") {
        out[key] = { one: o.one, other: o.other };
      } else {
        flatten(o, key, out);
      }
    }
  }
  return out;
}
function registerCatalog(locale, dict) {
  const existing = catalogs.get(locale) ?? {};
  catalogs.set(locale, Object.assign(existing, flatten(dict, "", {})));
}
function lookup(key) {
  return catalogs.get(activeLocale)?.[key] ?? catalogs.get(FALLBACK_LOCALE)?.[key];
}
function interpolate(template, params) {
  if (!params) return template;
  return template.replace(
    /\{(\w+)\}/g,
    (m, name) => name in params ? String(params[name]) : m
  );
}
function t(key, params) {
  const v = lookup(key);
  if (v === void 0) return interpolate(key, params);
  if (typeof v === "string") return interpolate(v, params);
  if (Array.isArray(v)) return interpolate(v[0] ?? key, params);
  const form = params?.count === 1 || params?.count === -1 ? v.one : v.other;
  return interpolate(form, params);
}

// src/i18n/server.ts
registerCatalog("en", { server: server_default });

// server/pages.ts
var privacyHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy Policy \u2014 Wild Willows</title>
<meta name="description" content="Privacy policy for Wild Willows, a cozy nature-restoration game.">
<style>
	:root {
		--bg: #f4f1e8;
		--card: #fffdf7;
		--ink: #33402e;
		--muted: #6b7263;
		--accent: #4a7c46;
		--rule: #dcd6c4;
	}
	* { box-sizing: border-box; }
	body {
		margin: 0;
		background: var(--bg);
		color: var(--ink);
		font: 17px/1.65 Georgia, 'Times New Roman', serif;
	}
	main {
		max-width: 46rem;
		margin: 0 auto;
		padding: 3rem 1.5rem 5rem;
	}
	.card {
		background: var(--card);
		border: 1px solid var(--rule);
		border-radius: 14px;
		padding: 2.5rem 2.75rem;
	}
	h1 {
		font-size: 1.9rem;
		line-height: 1.25;
		margin: 0 0 0.25rem;
		color: var(--accent);
	}
	.meta { color: var(--muted); font-size: 0.95rem; margin: 0 0 1.75rem; }
	h2 {
		font-size: 1.2rem;
		margin: 2.25rem 0 0.6rem;
		color: var(--accent);
		border-bottom: 1px solid var(--rule);
		padding-bottom: 0.35rem;
	}
	ul { padding-left: 1.3rem; }
	li { margin: 0.4rem 0; }
	a { color: var(--accent); }
	strong { color: var(--ink); }
	.footer { color: var(--muted); font-size: 0.9rem; margin-top: 2.5rem; text-align: center; }
	@media (max-width: 540px) { .card { padding: 1.5rem 1.25rem; } }
</style>
</head>
<body>
<main>
	<div class="card">
		<h1>Wild Willows \u2014 Privacy Policy</h1>
		<p class="meta">Effective July 3, 2026 \xB7 Developer: Bailey Dunning \xB7 <a href="mailto:wildwillowsgame@gmail.com">wildwillowsgame@gmail.com</a></p>

		<p>Wild Willows is a cozy nature-restoration game. It is designed to work fully offline, requires no account, and collects as little as possible. This page explains exactly what data the game handles, what (if anything) leaves your device, and how to reach me about it.</p>

		<h2>The short version</h2>
		<ul>
			<li>No account, no sign-in, no ads, no tracking, no third-party analytics.</li>
			<li>Your world lives in save files on your own device.</li>
			<li>When you're online, the game periodically sends me an <strong>anonymous gameplay-statistics snapshot</strong> (play time, things crafted, animals returned, and so on) identified only by a random ID, so I can see how the game is being played and improve it.</li>
			<li>The only personal information I ever receive is what <strong>you choose to type into the feedback form</strong> \u2014 including an optional email address if you'd like a reply.</li>
		</ul>

		<h2>Data stored on your device</h2>
		<p>Your saves are local files in the app's data folder. Each save holds your caretaker's name and appearance, your world (terrain, placements, plants, animals, chests), and gameplay counters. The game also uses local browser-style storage for small preferences and to queue unsent feedback while offline. None of this local data is readable by me; deleting the app (or the save files) removes it.</p>
		<p>The Mac App Store build is solo-only: there is no multiplayer, no account, and no passcode. The game is fully playable with no internet connection.</p>

		<h2>Gameplay statistics I collect (automatic, anonymous)</h2>
		<p>While the game is open and a network connection exists, it sends a snapshot of your save's gameplay statistics to my server roughly every five minutes, plus once when the window is hidden or closed. Each snapshot contains:</p>
		<ul>
			<li>a <strong>random identifier</strong> for the save slot (a UUID generated on your device \u2014 it is not derived from you, your device, or your Apple&nbsp;ID, and I cannot use it to identify you);</li>
			<li>the <strong>name you gave the save</strong> (I suggest a caretaker name rather than your real name);</li>
			<li>basic <strong>app and platform information</strong>: app version, build timestamp, platform ("desktop" or "web"), operating system family (mac / windows / linux), and the interface language you play in (e.g. English or Spanish);</li>
			<li><strong>gameplay counters</strong>: play time, number of sessions, resources collected, items crafted, objects placed, plants planted, animals observed and returned, biomes unlocked, achievements earned, and similar progression numbers.</li>
		</ul>
		<p>That's the whole list. Snapshots contain no location data, no contact information, no device identifiers, and no advertising identifiers. I use them solely to understand how Wild Willows is played and to improve it. Sending is best-effort: if you're offline, reports are simply skipped \u2014 they are not queued, and the game does not nag you to connect.</p>

		<h2>Feedback you choose to send</h2>
		<p>The in-game feedback form (in Settings) sends me whatever message you type, plus light diagnostic context so a report like "the game feels slow" makes sense: app version and build, platform and operating system, browser user-agent string, your save's name, tutorial progress, unlocked biomes, achievement count, and play time.</p>
		<p>You may optionally include an <strong>email address</strong> if you'd like a reply. It is used only to respond to your feedback \u2014 never for marketing, and never shared. If you're offline when you submit, the feedback is stored on your device and sent automatically once a connection returns. On my server, feedback (including any reply email) is readable only by me, the developer.</p>

		<h2>What I don't do</h2>
		<p>I do not sell, rent, or share your data with anyone. The game contains no advertising, no tracking SDKs, no third-party analytics, and no social integrations. I do not profile you, and I do not combine game data with data from other sources. The app makes outgoing HTTPS connections only, and only to my own server. (Builds distributed through the Mac App Store contain no Steam integration; builds launched through Steam sync gameplay stats and achievements to your Steam profile, which is governed by Valve's privacy policy.)</p>

		<h2>Where data is stored</h2>
		<p>Gameplay snapshots and feedback are stored in my database on my hosting provider's infrastructure, which processes the data only on my behalf. Data is transmitted over HTTPS.</p>

		<h2>Retention and deletion</h2>
		<p>Gameplay snapshots are kept so long-term trends stay visible; each save slot has exactly one row that is overwritten by its latest snapshot. Feedback is kept until it has been read and acted on. To have either deleted, email <a href="mailto:wildwillowsgame@gmail.com">wildwillowsgame@gmail.com</a> \u2014 include your save's name for snapshots, or the approximate date and message for feedback, and I'll remove it. Deleting the app from your device stops all collection immediately.</p>

		<h2>Children</h2>
		<p>Wild Willows is suitable for all ages. I do not knowingly collect personal information from children; the game never asks for a real name, and the only free-text personal data anywhere is the optional feedback email. If you believe a child has submitted personal information through the feedback form, contact me and I will delete it.</p>

		<h2>The web and co-op versions</h2>
		<p>If you play the browser version (or a future co-op build), your save lives on my server instead of your device: the save name, a passcode (stored only as a salted hash, never in plaintext), your caretaker's appearance, and your world state. Co-op worlds additionally share world state and live player positions with the other members of that world. Everything else in this policy \u2014 no ads, no tracking, no sharing \u2014 applies identically.</p>

		<h2>Changes to this policy</h2>
		<p>If the game's data practices ever change, I will update this policy, revise the effective date above, and note the change in the game's release notes. Material changes will be called out in-game.</p>

		<h2>Contact</h2>
		<p>Questions, concerns, or deletion requests: <a href="mailto:wildwillowsgame@gmail.com">wildwillowsgame@gmail.com</a>.</p>
	</div>
	<p class="footer">Wild Willows \u{1F33F} \xB7 <a href="/age-rating.html">Age Suitability</a></p>
</main>
</body>
</html>
`;
var ageRatingHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Age Suitability \u2014 Wild Willows</title>
<meta name="description" content="Age suitability and content information for Wild Willows, a cozy nature-restoration game.">
<style>
	:root {
		--bg: #f4f1e8;
		--card: #fffdf7;
		--ink: #33402e;
		--muted: #6b7263;
		--accent: #4a7c46;
		--rule: #dcd6c4;
	}
	* { box-sizing: border-box; }
	body {
		margin: 0;
		background: var(--bg);
		color: var(--ink);
		font: 17px/1.65 Georgia, 'Times New Roman', serif;
	}
	main {
		max-width: 46rem;
		margin: 0 auto;
		padding: 3rem 1.5rem 5rem;
	}
	.card {
		background: var(--card);
		border: 1px solid var(--rule);
		border-radius: 14px;
		padding: 2.5rem 2.75rem;
	}
	h1 {
		font-size: 1.9rem;
		line-height: 1.25;
		margin: 0 0 0.25rem;
		color: var(--accent);
	}
	.meta { color: var(--muted); font-size: 0.95rem; margin: 0 0 1.75rem; }
	h2 {
		font-size: 1.2rem;
		margin: 2.25rem 0 0.6rem;
		color: var(--accent);
		border-bottom: 1px solid var(--rule);
		padding-bottom: 0.35rem;
	}
	ul { padding-left: 1.3rem; }
	li { margin: 0.4rem 0; }
	a { color: var(--accent); }
	strong { color: var(--ink); }
	.badge {
		display: inline-block;
		background: var(--accent);
		color: #fffdf7;
		border-radius: 999px;
		padding: 0.15rem 0.9rem;
		font-size: 0.95rem;
		margin: 0 0.4rem 0.4rem 0;
	}
	.footer { color: var(--muted); font-size: 0.9rem; margin-top: 2.5rem; text-align: center; }
	@media (max-width: 540px) { .card { padding: 1.5rem 1.25rem; } }
</style>
</head>
<body>
<main>
	<div class="card">
		<h1>Wild Willows \u2014 Age Suitability</h1>
		<p class="meta">Effective July 3, 2026 \xB7 Developer: Bailey Dunning \xB7 <a href="mailto:wildwillowsgame@gmail.com">wildwillowsgame@gmail.com</a></p>

		<p>Wild Willows is a cozy nature-restoration game: you gather fallen materials, craft and plant habitat, and watch real animals return as the land recovers. It is designed to be <strong>suitable for all ages</strong>.</p>

		<p>
			<span class="badge">Apple App Store: 4+</span>
			<span class="badge">ESRB: Everyone</span>
			<span class="badge">PEGI: 3</span>
		</p>

		<h2>What the game contains</h2>
		<ul>
			<li><strong>Gentle, non-violent play.</strong> There is no combat, no enemies, and no way to fail. Animals are observed and welcomed home \u2014 never hunted, harmed, captured, or lost. Nothing dies.</li>
			<li><strong>Educational nature content.</strong> Every animal comes with a real-world fact, and an in-game weather &amp; seasons guide explains real ecology in plain language, grounded in credible sources (USGS, NOAA, NPS, Audubon, and similar).</li>
			<li><strong>Mild ambient weather only.</strong> Rain, storms, fog, snow, and heat are visual atmosphere \u2014 they never threaten the player or the animals.</li>
			<li><strong>Simple friendly art.</strong> All visuals are soft, procedurally generated shapes; there is no realistic, frightening, or graphic imagery.</li>
		</ul>

		<h2>What the game does not contain</h2>
		<ul>
			<li>No violence, blood, or scary content</li>
			<li>No profanity, crude humor, or mature themes</li>
			<li>No alcohol, tobacco, or drug references</li>
			<li>No gambling, simulated or otherwise</li>
			<li>No advertising of any kind</li>
			<li>No in-app purchases, loot boxes, or microtransactions</li>
			<li>No chat, social features, or user-generated content from other players (the Mac App Store build is solo-only)</li>
			<li>No account, sign-in, or personal information required to play</li>
		</ul>

		<h2>Online features</h2>
		<p>The game is fully playable offline. When online, it sends only anonymous gameplay statistics (play time, items crafted, animals returned) so I can improve the game \u2014 nothing personal, and nothing is shown to or shared with other players. An optional feedback form in Settings sends a message privately to the developer; it is the only free-text input that leaves the device, and including an email address is optional. Full details are in the <a href="/privacy.html">privacy policy</a>.</p>

		<p>If a future update enables the optional co-op mode (web version), players join a shared world only by invite code with the host's explicit approval, and other players see just a chosen caretaker name and character \u2014 there is no chat system.</p>

		<h2>For parents</h2>
		<p>Wild Willows has no mechanisms that pressure play: no timers that punish absence (a world you leave is exactly where you left it), no daily-login streaks to lose, no purchases to make, and no strangers to encounter. If you have any questions, email <a href="mailto:wildwillowsgame@gmail.com">wildwillowsgame@gmail.com</a>.</p>
	</div>
	<p class="footer">Wild Willows \u{1F33F} \xB7 <a href="/privacy.html">Privacy Policy</a></p>
</main>
</body>
</html>
`;
var supportHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Support \u2014 Wild Willows</title>
<meta name="description" content="Support, help, and frequently asked questions for Wild Willows, a cozy nature-restoration game.">
<style>
	:root {
		--bg: #f4f1e8;
		--card: #fffdf7;
		--ink: #33402e;
		--muted: #6b7263;
		--accent: #4a7c46;
		--rule: #dcd6c4;
	}
	* { box-sizing: border-box; }
	body {
		margin: 0;
		background: var(--bg);
		color: var(--ink);
		font: 17px/1.65 Georgia, 'Times New Roman', serif;
	}
	main {
		max-width: 46rem;
		margin: 0 auto;
		padding: 3rem 1.5rem 5rem;
	}
	.card {
		background: var(--card);
		border: 1px solid var(--rule);
		border-radius: 14px;
		padding: 2.5rem 2.75rem;
	}
	h1 {
		font-size: 1.9rem;
		line-height: 1.25;
		margin: 0 0 0.25rem;
		color: var(--accent);
	}
	.meta { color: var(--muted); font-size: 0.95rem; margin: 0 0 1.75rem; }
	h2 {
		font-size: 1.2rem;
		margin: 2.25rem 0 0.6rem;
		color: var(--accent);
		border-bottom: 1px solid var(--rule);
		padding-bottom: 0.35rem;
	}
	ul { padding-left: 1.3rem; }
	li { margin: 0.4rem 0; }
	a { color: var(--accent); }
	strong { color: var(--ink); }
	kbd {
		font: 0.85em ui-monospace, SFMono-Regular, Menlo, monospace;
		background: var(--bg);
		border: 1px solid var(--rule);
		border-bottom-width: 2px;
		border-radius: 5px;
		padding: 0.05rem 0.4rem;
	}
	.contact {
		background: var(--bg);
		border: 1px solid var(--rule);
		border-radius: 10px;
		padding: 1rem 1.25rem;
		margin: 1rem 0;
	}
	.footer { color: var(--muted); font-size: 0.9rem; margin-top: 2.5rem; text-align: center; }
	@media (max-width: 540px) { .card { padding: 1.5rem 1.25rem; } }
</style>
</head>
<body>
<main>
	<div class="card">
		<h1>Wild Willows \u2014 Support</h1>
		<p class="meta">Developer: Bailey Dunning \xB7 <a href="mailto:wildwillowsgame@gmail.com">wildwillowsgame@gmail.com</a></p>

		<p>Wild Willows is a cozy nature-restoration game: gather fallen materials, craft and plant habitat, and welcome real animals back as the land recovers. If something isn't working \u2014 or you just have a question \u2014 here's how to get help.</p>

		<h2>Contact</h2>
		<div class="contact">
			<p style="margin:0"><strong>Email:</strong> <a href="mailto:wildwillowsgame@gmail.com">wildwillowsgame@gmail.com</a> \u2014 I read everything and reply as quickly as I can.</p>
		</div>
		<p>You can also send feedback <strong>from inside the game</strong>: open <strong>Settings</strong> (press <kbd>G</kbd>) and use the feedback form. Include your email if you'd like a reply. It works offline too \u2014 the message is kept on your device and sent automatically once you're connected.</p>

		<h2>Common questions</h2>
		<ul>
			<li><strong>Do I need an internet connection?</strong> No. The game is fully playable offline, with no account and no sign-in.</li>
			<li><strong>A keyboard is required.</strong> Move with <kbd>WASD</kbd> or the arrow keys; press <kbd>H</kbd> (or the <strong>?</strong> button) any time for the full How to Play reference.</li>
			<li><strong>Where are my saves?</strong> Save files live on your device, inside the app's data folder. Deleting the app removes them, so keep a backup if you're reinstalling and want to keep your preserve.</li>
			<li><strong>How do I start over?</strong> Create a new save from the title screen, or delete a save from the Load Game menu.</li>
			<li><strong>Something looks stuck or broken.</strong> Quit and reopen the app first \u2014 your world is saved after every action, so nothing is lost. If it persists, email me or use the in-game feedback form and describe what you were doing; the report arrives with the version info I need.</li>
			<li><strong>The window opened but the game says "connect a keyboard."</strong> Wild Willows is keyboard-driven by design; pressing any key on a connected keyboard dismisses the gate.</li>
		</ul>

		<h2>Feature requests</h2>
		<p>Ideas are as welcome as bug reports \u2014 the feedback form and email both come straight to me, the developer.</p>

		<h2>Privacy &amp; age suitability</h2>
		<p>Wild Willows collects almost nothing \u2014 see the <a href="/privacy.html">privacy policy</a> for exactly what and why, and the <a href="/age-rating.html">age-suitability page</a> for content information (suitable for all ages).</p>
	</div>
	<p class="footer">Wild Willows \u{1F33F} \xB7 <a href="/privacy.html">Privacy Policy</a> \xB7 <a href="/age-rating.html">Age Suitability</a></p>
</main>
</body>
</html>
`;
var buildStamp = "0.1.11+2026-07-10T22:09:59.845Z";

// server/resources.ts
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
var WEATHER_BIOME_IDS = biomes_default.records.map((b) => b.id);
function weatherTimeFromPlay(player) {
  return Math.max(0, Math.round((player?.metrics?.playSeconds || 0) * 1e3) + (player?.clockOffsetMs || 0));
}
var db = () => {
  const d = typeof databases !== "undefined" && databases ? databases.wildwillows : null;
  if (!d || !d.Player) throw new GameError(t("server.err.dbStarting"), 503);
  return d;
};
var GameError = class extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
};
var clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = a + 1831565813 | 0;
    let t2 = Math.imul(a ^ a >>> 15, 1 | a);
    t2 = t2 + Math.imul(t2 ^ t2 >>> 7, 61 | t2) ^ t2;
    return ((t2 ^ t2 >>> 14) >>> 0) / 4294967296;
  };
}
function posInt(n, label) {
  const v = Number(n);
  if (!Number.isInteger(v) || v <= 0) throw new GameError(t("server.err.positiveWholeNumber", { label }));
  return v;
}
function sumValues(obj) {
  if (!obj) return 0;
  return Object.values(obj).reduce((a, b) => a + (b || 0), 0);
}
function isDecodeError(e) {
  return /end of buffer|buffer not reached|decod/i.test(String(e?.message || e));
}
async function forceRemove(table, id) {
  try {
    await table.delete(id);
    return true;
  } catch (e) {
    if (!isDecodeError(e)) throw e;
  }
  try {
    await table.put({ id });
    await table.delete(id);
    return true;
  } catch {
    return false;
  }
}
async function safeGet(table, id) {
  try {
    const rec = await table.get(id);
    if (rec) {
      try {
        JSON.stringify({ ...rec });
      } catch (e) {
        if (isDecodeError(e)) throw e;
      }
    }
    return rec;
  } catch (e) {
    if (isDecodeError(e)) {
      await forceRemove(table, id);
      console.error(`purged undecodable record: ${id}`);
      return null;
    }
    throw e;
  }
}
async function toArray(iterable) {
  const out = [];
  try {
    for await (const item of iterable) out.push(item);
  } catch (e) {
    console.error("scan: skipping undecodable record(s) \u2014", e?.message || e);
  }
  return out;
}
async function allOf(table) {
  if (!table || typeof table.search !== "function") return [];
  return toArray(table.search({}));
}
async function byPlayer(table, playerId) {
  if (!table || typeof table.search !== "function") return [];
  const rows = await toArray(table.search({}));
  return rows.filter((r) => r?.playerId === playerId);
}
function worldOf(player) {
  return player?.worldId || player?.id;
}
async function byWorld(table, worldId) {
  if (!table || typeof table.search !== "function") return [];
  const rows = await toArray(table.search({}));
  return rows.filter((r) => (r?.worldId ?? r?.playerId) === worldId);
}
async function findInWorld(table, worldId, id) {
  const rows = await byWorld(table, worldId);
  return rows.find((r) => r.id === id) || null;
}
async function findTerrainAt(table, worldId, area, x, y) {
  const rows = await byWorld(table, worldId);
  return rows.find((r) => r.area === area && r.x === x && r.y === y) || null;
}
async function findBiomeState(table, worldId, biomeId) {
  const rows = await byWorld(table, worldId);
  return rows.find((r) => r.biomeId === biomeId) || null;
}
async function findDiscovery(table, worldId, animalId) {
  const rows = await byWorld(table, worldId);
  return rows.find((r) => r.animalId === animalId) || null;
}
function genJoinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
var DEFAULT_MAX_MEMBERS = 6;
async function ensureSoloWorld(player, opts = {}) {
  const t2 = db();
  const soloId = player.id;
  if (!await t2.World.get(soloId)) {
    await t2.World.put({
      id: soloId,
      name: player.name ? t("server.world.soloName", { name: player.name }) : t("server.world.mySoloName"),
      solo: true,
      ownerId: player.id,
      joinCode: null,
      createdAt: player.createdAt || Date.now(),
      maxMembers: 1,
      // brand-new saves are seeded at the shifted meadow coordinates already,
      // so the world starts aligned to the current camp offset; older worlds
      // omit these and get realigned by migrateMeadowWest below.
      meadowShift: opts.freshGrid ? MEADOW_SHIFT : 0,
      meadowShiftY: opts.freshGrid ? MEADOW_SHIFT_Y : 0
    });
  }
  const memberId = `${soloId}:${player.id}`;
  if (!await t2.WorldMember.get(memberId)) {
    await t2.WorldMember.put({
      id: memberId,
      worldId: soloId,
      playerId: player.id,
      role: "owner",
      joinedAt: player.createdAt || Date.now(),
      lastSeenAt: Date.now()
    });
  }
  if (!player.worldId) await t2.Player.patch(player.id, { worldId: soloId });
  if (!opts.freshGrid) await migrateMeadowWest(soloId);
}
async function listMemberships(playerId) {
  const t2 = db();
  const members = await byPlayer(t2.WorldMember, playerId);
  const out = [];
  for (const m of members) {
    const world = await t2.World.get(m.worldId);
    if (!world) continue;
    const memberCount = (await byWorld(t2.WorldMember, world.id)).length;
    out.push({
      worldId: world.id,
      name: world.name,
      solo: !!world.solo,
      role: m.role,
      joinCode: world.solo ? null : world.joinCode,
      memberCount,
      maxMembers: world.maxMembers || DEFAULT_MAX_MEMBERS,
      isOwner: world.ownerId === playerId
    });
  }
  return out.sort((a, b) => a.solo === b.solo ? 0 : a.solo ? -1 : 1);
}
async function syncMemberUnlocks(playerId, worldId) {
  const t2 = db();
  const player = await t2.Player.get(playerId);
  if (!player) return [];
  const current = player.unlockedBiomes || ["meadow"];
  if (worldId === player.id) return current;
  const worldStates = await byWorld(t2.BiomeState, worldId);
  const unlocked = new Set(current);
  for (const bs of worldStates) if (bs.unlocked) unlocked.add(bs.biomeId);
  const merged = [...unlocked];
  if (merged.length !== current.length) await t2.Player.patch(playerId, { unlockedBiomes: merged });
  return merged;
}
var defsReconciled = false;
async function reconcileDefinitions() {
  if (defsReconciled) return;
  defsReconciled = true;
  const t2 = db();
  const sources = [
    [t2.Biome, biomes_default.records],
    [t2.Recipe, recipes_default.records],
    [t2.HabitatObject, habitat_objects_default.records],
    [t2.ToolDef, tools_default.records],
    [t2.ResourceType, resources_default.records],
    [t2.Animal, [...animals_1_default.records, ...animals_2_default.records]],
    [t2.Achievement, achievements_default.records]
  ];
  for (const [table, records] of sources) {
    const valid = new Set(records.map((r) => r.id));
    for (const row of await toArray(table.search({}))) {
      if (!valid.has(row.id)) await table.delete(row.id);
    }
    for (const rec of records) await table.put(rec);
  }
}
var defsCache = null;
async function defs() {
  await reconcileDefinitions();
  if (!defsCache) {
    const t2 = db();
    const [biomes, animals, resources, recipes, objects, tools, achievements] = await Promise.all([
      allOf(t2.Biome),
      allOf(t2.Animal),
      allOf(t2.ResourceType),
      allOf(t2.Recipe),
      allOf(t2.HabitatObject),
      allOf(t2.ToolDef),
      allOf(t2.Achievement)
    ]);
    const index = (arr) => new Map(arr.map((r) => [r.id, r]));
    achievements.sort((a, b) => (a.order || 0) - (b.order || 0));
    defsCache = {
      biomes,
      animals,
      resources,
      recipes,
      objects,
      tools,
      achievements,
      biome: index(biomes),
      animal: index(animals),
      resource: index(resources),
      recipe: index(recipes),
      object: index(objects),
      tool: index(tools),
      achievement: index(achievements)
    };
  }
  return defsCache;
}
var NODE_REGEN_SECONDS = 75;
var BASE_HEALTH = 5;
var FIRST_ANIMAL_ID = "grasshopper";
var FEED_CAP = 100;
var HOME_BUILD_GATE = { biome: "meadow", minHealth: 30 };
var HOME_STYLES = {
  cabin: { name: "Log Cabin", floor: "#c8a064", wall: "#5e3f29", accent: "#b5707a", materials: { branches: 16, fiber: 6 }, requires: HOME_BUILD_GATE, perk: { id: "forage", base: 0.1, perLevel: 0.05, cap: 0.6 } },
  // warm golden pine + dark logs
  cottage: { name: "Meadow Cottage", floor: "#e6d3a6", wall: "#aab9c6", accent: "#7fae6a", materials: { wildflowers: 6, fiber: 10, clay: 4 }, requires: HOME_BUILD_GATE, perk: { id: "growth", base: 0.1, perLevel: 0.04, cap: 0.5 } },
  // pale wood + airy blue-grey + green
  stone: { name: "Stone Hearth", floor: "#a9a499", wall: "#6f6a62", accent: "#d98a4f", materials: { stones: 14, clay: 6 }, requires: HOME_BUILD_GATE, perk: { id: "thrift", base: 0.1, perLevel: 0.05, cap: 0.6 } }
  // slate floor + grey stone + hearth orange
};
var DEFAULT_HOME = { style: "cabin", space: 1, comfort: 1, decor: 1, light: 1, styleLocked: false };
var HOME_TRACKS = {
  space: {
    name: "Space",
    blurb: "A bigger room with more floor to decorate.",
    levels: [
      { inner: { w: 6, h: 5 } },
      // tent
      { inner: { w: 8, h: 6 }, materials: { branches: 12, fiber: 8 }, requires: { biome: "meadow", minHealth: 30 } },
      { inner: { w: 10, h: 7 }, materials: { branches: 18, stones: 6, clay: 6 }, requires: { biome: "forest", minHealth: 45 } },
      { inner: { w: 12, h: 9 }, materials: { branches: 24, clay: 10, "clean-water": 6 }, requires: { biome: "wetland", minHealth: 55 } }
    ]
  },
  comfort: {
    name: "Comfort",
    blurb: "Carry more on every gathering trip (+capacity).",
    levels: [
      { carry: 0 },
      { carry: 45, materials: { fiber: 10, branches: 4 }, requires: { biome: "meadow", minHealth: 35 } },
      { carry: 95, materials: { fiber: 14, moss: 6 }, requires: { biome: "forest", minHealth: 50 } },
      { carry: 160, materials: { reeds: 10, fiber: 12 }, requires: { biome: "wetland", minHealth: 60 } }
    ]
  },
  decor: {
    name: "Furnishings",
    blurb: "A finer rug and wall trim in your style.",
    levels: [
      {},
      { materials: { fiber: 8, wildflowers: 4 } },
      { materials: { fiber: 12, berries: 6 }, requires: { biome: "meadow", minHealth: 50 } },
      { materials: { fiber: 16, clay: 6 }, requires: { biome: "forest", minHealth: 55 } }
    ]
  },
  light: {
    name: "Warmth",
    blurb: "Windows and a warm hearth glow.",
    levels: [
      {},
      { materials: { branches: 6, stones: 4 } },
      { materials: { stones: 8, clay: 4 }, requires: { biome: "forest", minHealth: 45 } },
      { materials: { clay: 6, "clean-water": 4 }, requires: { biome: "wetland", minHealth: 55 } }
    ]
  }
};
function homeOf(player) {
  if (player?.home) return { ...DEFAULT_HOME, ...player.home };
  const t2 = player?.homeTier || 1;
  return { ...DEFAULT_HOME, space: t2, comfort: t2, styleLocked: t2 > 1 };
}
var homeCarryBonus = (player) => HOME_TRACKS.comfort.levels[(homeOf(player).comfort || 1) - 1]?.carry || 0;
var HOME_BASE_LEVELS = 5;
function homePerk(player) {
  const home = homeOf(player);
  if (!home.styleLocked) return null;
  const perk = HOME_STYLES[home.style]?.perk;
  if (!perk) return null;
  const levels = (home.space || 1) + (home.comfort || 1) + (home.decor || 1) + (home.light || 1);
  const strength = Math.min(perk.cap, perk.base + perk.perLevel * Math.max(0, levels - HOME_BASE_LEVELS));
  return { id: perk.id, strength };
}
function homeRoom(player) {
  const inner = HOME_TRACKS.space.levels[(homeOf(player).space || 1) - 1]?.inner || { w: 8, h: 6 };
  const x0 = Math.floor((GRID_W - inner.w) / 2);
  const y0 = Math.floor((GRID_H - inner.h) / 2);
  return { x0, y0, x1: x0 + inner.w - 1, y1: y0 + inner.h - 1 };
}
var DIG_FIND_CHANCE = 0.75;
var CAPACITY_BY_BASKET = { 1: 200, 2: 350, 3: 550, 4: 800 };
var START_INVENTORY = { water: 6, wildflowers: 1 };
var START_TOOLS = { basket: 1, shovel: 1, "watering-can": 1, "field-journal": 1 };
var SKIN_TONES = ["#f6d7b8", "#eec39a", "#d9a06b", "#b97f50", "#8d5a3a", "#6b4226"];
var HAIR_COLORS = ["#3b2e25", "#6e4a33", "#a3692f", "#c9913f", "#d9b380", "#8c8c8c"];
var OUTFIT_COLORS = ["#4a7c59", "#7a9ac0", "#b5707a", "#c9913f", "#7d6b9e", "#5d8a8a"];
var HAT_STYLES = ["straw", "leaf", "beanie", "cap", "bucket", "flower", "party", "ranger", "mushroom", "wizard", "crown", "bandana", "none"];
var HAT_COLORS = ["#c9a35c", "#b5707a", "#5f86b0", "#5d8a4a", "#7d6b9e", "#b05555"];
var HAIRSTYLES = ["short", "bald", "long", "bob", "curly", "curly-long", "bun", "braid", "ponytail", "pigtails", "afro", "mohawk"];
var BEARD_STYLES = ["none", "beard"];
var BODY_TYPES = ["slim", "round"];
function cleanHex(c, fallback) {
  return typeof c === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c.trim()) ? c.trim().toLowerCase() : fallback;
}
function sanitizeAppearance(a) {
  a = a || {};
  return {
    skin: cleanHex(a.skin, SKIN_TONES[1]),
    hair: cleanHex(a.hair, HAIR_COLORS[1]),
    outfit: cleanHex(a.outfit, OUTFIT_COLORS[0]),
    hat: HAT_STYLES.includes(a.hat) ? a.hat : "straw",
    // null means "the hat's classic colors" — only a valid hex overrides it
    hatColor: typeof a.hatColor === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(a.hatColor.trim()) ? a.hatColor.trim().toLowerCase() : null,
    hairstyle: HAIRSTYLES.includes(a.hairstyle) ? a.hairstyle : "short",
    beard: BEARD_STYLES.includes(a.beard) ? a.beard : "none",
    body: BODY_TYPES.includes(a.body) ? a.body : "slim"
  };
}
function sanitizePlayer(player) {
  if (!player) return player;
  const { passcode, passcodeHash, passcodeSalt, ...rest } = player;
  return rest;
}
function hashPasscode(passcode, salt) {
  const s = salt || randomBytes(16).toString("hex");
  const hash = scryptSync(String(passcode), s, 32).toString("hex");
  return { salt: s, hash };
}
function checkHash(passcode, salt, hash) {
  try {
    const B = globalThis.Buffer;
    const got = scryptSync(String(passcode), salt, 32);
    const want = B.from(hash, "hex");
    return got.length === want.length && timingSafeEqual(got, want);
  } catch {
    return false;
  }
}
async function verifyPasscode(player, passcode) {
  const code = String(passcode || "");
  if (player.passcodeHash && player.passcodeSalt) {
    return checkHash(code, player.passcodeSalt, player.passcodeHash);
  }
  if (typeof player.passcode === "string" && code.length > 0 && code === player.passcode) {
    const { salt, hash } = hashPasscode(code);
    await db().Player.patch(player.id, { passcodeHash: hash, passcodeSalt: salt, passcode: null });
    return true;
  }
  return false;
}
function slugId(name) {
  return String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
var STARTER_CHEST = { x: 23, y: 5, size: "small-chest", capacity: 120 };
var MEADOW_SHIFT = 14;
var MEADOW_SHIFT_Y = 0;
async function migrateMeadowWest(wid) {
  const t2 = db();
  const world = await safeGet(t2.World, wid);
  const applied = typeof world?.meadowShift === "number" ? world.meadowShift : 0;
  const appliedY = typeof world?.meadowShiftY === "number" ? world.meadowShiftY : 0;
  const delta = MEADOW_SHIFT - applied;
  const deltaY = MEADOW_SHIFT_Y - appliedY;
  if (delta !== 0 || deltaY !== 0) {
    for (const table of [t2.Placement, t2.TerrainTile, t2.Chest]) {
      for (const row of await byWorld(table, wid)) {
        if (row.area !== "meadow") continue;
        await table.patch(row.id, { x: (Number(row.x) || 0) + delta, y: (Number(row.y) || 0) + deltaY });
      }
    }
    for (const m of await byWorld(t2.WorldMember, wid)) {
      const p = await safeGet(t2.Player, m.playerId);
      if (p?.area === "meadow" && worldOf(p) === wid) {
        await t2.Player.patch(p.id, { x: (Number(p.x) || 0) + delta, y: (Number(p.y) || 0) + deltaY });
      }
    }
  }
  if (world && (applied !== MEADOW_SHIFT || appliedY !== MEADOW_SHIFT_Y)) await t2.World.patch(wid, { meadowShift: MEADOW_SHIFT, meadowShiftY: MEADOW_SHIFT_Y });
  return delta !== 0 || deltaY !== 0;
}
async function requirePlayer(playerId) {
  if (!playerId || typeof playerId !== "string") throw new GameError(t("server.err.playerIdRequired"));
  const player = await safeGet(db().Player, playerId);
  if (!player) throw new GameError(t("server.err.noSaveLogin"), 404);
  return { player };
}
function freshMetrics(now) {
  return {
    firstSeenAt: now,
    lastSeenAt: now,
    lastHeartbeatAt: 0,
    playSeconds: 0,
    sessions: 0,
    counts: {}
  };
}
async function bumpMetrics(player, deltas = {}, dailyDeltas = {}) {
  if (!player?.id) return null;
  const entries = Object.entries(deltas).filter(([, v]) => v);
  const dailyEntries = Object.entries(dailyDeltas).filter(([, v]) => v);
  if (!entries.length && !dailyEntries.length) return player.metrics || null;
  const now = Date.now();
  const live = await db().Player.get(player.id) || player;
  const prev = live.metrics || freshMetrics(live.createdAt || now);
  const counts = { ...prev.counts || {} };
  for (const [k, v] of entries) counts[k] = (counts[k] || 0) + v;
  const metrics = { ...prev, counts, lastSeenAt: now };
  const patch = { metrics };
  if (dailyEntries.length) {
    const dayKey = playerDayKey(live, now);
    const prevDaily = live.daily?.dayKey === dayKey ? live.daily : { dayKey, counts: {} };
    const dcounts = { ...prevDaily.counts || {} };
    for (const [k, v] of dailyEntries) dcounts[k] = (dcounts[k] || 0) + v;
    patch.daily = { dayKey, counts: dcounts };
  }
  await db().Player.patch(player.id, patch);
  return metrics;
}
var DAY_MS2 = 864e5;
var TASK_RESET_HOUR = 4;
var tzMs = (player) => (Number.isFinite(player?.tzOffsetMinutes) ? player.tzOffsetMinutes : 0) * 6e4;
var sanitizeTzOffset = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? clamp(n, -840, 840) : 0;
};
function playerDayKey(player, at) {
  return Math.floor((at + tzMs(player) - TASK_RESET_HOUR * 36e5) / DAY_MS2);
}
var round1 = (n) => Math.round(n * 10) / 10;
var META_COUNTERS = /* @__PURE__ */ new Set(["recolors", "appearanceChanges"]);
function metricsView(player) {
  const now = Date.now();
  const m = player.metrics || freshMetrics(player.createdAt || now);
  const playSeconds = m.playSeconds || 0;
  const sessions = m.sessions || 0;
  const counts = m.counts || {};
  const totalActions = Object.entries(counts).reduce((a, [k, b]) => a + (META_COUNTERS.has(k) ? 0 : b || 0), 0);
  const createdAt = player.createdAt || m.firstSeenAt || now;
  const lastSeenAt = m.lastSeenAt || null;
  const hoursSinceActive = lastSeenAt ? round1((now - lastSeenAt) / 36e5) : null;
  const daysSinceJoined = Math.floor((now - createdAt) / DAY_MS2);
  let status = "dormant";
  if (hoursSinceActive != null) {
    if (hoursSinceActive <= 24) status = "active";
    else if (hoursSinceActive <= 24 * 7) status = "recent";
  }
  return {
    playerId: player.id,
    name: player.name,
    createdAt,
    firstSeenAt: m.firstSeenAt || createdAt,
    lastSeenAt,
    daysSinceJoined,
    hoursSinceActive,
    status,
    isNewToday: now - createdAt <= DAY_MS2,
    language: m.language || null,
    // interface language from the heartbeat
    // time + sessions
    sessions,
    playSeconds,
    playMinutes: Math.round(playSeconds / 60),
    avgSessionMinutes: sessions ? Math.round(playSeconds / 60 / sessions) : 0,
    // engagement intensity
    totalActions,
    actionsPerSession: sessions ? round1(totalActions / sessions) : 0,
    actionsPerMinute: playSeconds > 0 ? round1(totalActions / (playSeconds / 60)) : 0,
    // where they are in the game
    tutorialStep: player.tutorialStep || 0,
    currentArea: player.area || null,
    unlockedBiomes: (player.unlockedBiomes || []).length,
    counts
  };
}
function activationFlags(view, biomeSummary, player) {
  const c = view.counts || {};
  return {
    collected: (c.resourcesCollected || 0) > 0,
    crafted: (c.itemsCrafted || 0) > 0 || Object.keys(player.craftedEver || {}).length > 0,
    placed: (c.objectsPlaced || 0) > 0,
    attractedAnimal: (biomeSummary?.totalAnimalsReturned || 0) > 0,
    unlockedSecondBiome: (view.unlockedBiomes || 0) >= 2
  };
}
var GRID_W = 30;
var GRID_H = 20;
var ALPINE_MTN_ROWS = 8;
function areaGrid(d, area) {
  const g = area === "home" ? null : d.biome.get(area)?.grid;
  const cols = g?.cols || GRID_W;
  const rows = (g?.rows || GRID_H) + (area === "alpine" ? ALPINE_MTN_ROWS : 0);
  return { cols, rows };
}
var TERRAIN_COLORS = {
  tilled: "#8a6a48",
  watered: "#6b4f33",
  water: "#5d96c8"
};
function lerpHex(a, b, t2) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const mix = (sh) => {
    const ca = pa >> sh & 255;
    const cb = pb >> sh & 255;
    return Math.round(ca + (cb - ca) * clamp(t2, 0, 1));
  };
  return "#" + [mix(16), mix(8), mix(0)].map((n) => n.toString(16).padStart(2, "0")).join("");
}
var svgEscape = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function renderBiomeSVG(d, biome, health, placements, terrain) {
  const cell = 16;
  const pad = 8;
  const labelH = 22;
  const grid = areaGrid(d, biome?.id || "");
  const W = grid.cols * cell + pad * 2;
  const H = grid.rows * cell + pad * 2 + labelH;
  const damaged = biome?.palette?.damaged || "#b9a37c";
  const healthy = biome?.palette?.healthy || "#8fbf6f";
  const ground = lerpHex(damaged, healthy, health / 100);
  const groundDark = lerpHex(damaged, healthy, health / 100 * 0.8);
  const px = (x) => pad + x * cell;
  const py = (y) => pad + y * cell;
  const parts = [];
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" rx="10" fill="${ground}"/>`);
  for (let gy = 0; gy < grid.rows; gy++) {
    for (let gx = 0; gx < grid.cols; gx++) {
      if ((gx + gy) % 2 === 0) {
        parts.push(`<rect x="${px(gx)}" y="${py(gy)}" width="${cell}" height="${cell}" fill="${groundDark}" opacity="0.22"/>`);
      }
    }
  }
  for (const tt of terrain) {
    const c = TERRAIN_COLORS[tt.type];
    if (!c) continue;
    parts.push(`<rect x="${px(tt.x)}" y="${py(tt.y)}" width="${cell}" height="${cell}" rx="3" fill="${c}"/>`);
  }
  for (const p of placements) {
    const def = d.object.get(p.objectId);
    const c = def?.color || "#6b5a3a";
    parts.push(
      `<circle cx="${px(p.x) + cell / 2}" cy="${py(p.y) + cell / 2}" r="${cell * 0.42}" fill="${c}" stroke="#2b3321" stroke-opacity="0.35"/>`
    );
  }
  parts.push(`<rect x="0" y="${H - labelH}" width="${W}" height="${labelH}" fill="#2b3321" opacity="0.55"/>`);
  parts.push(
    `<text x="${pad}" y="${H - 7}" font-family="sans-serif" font-size="12" fill="#fdfaf0">${svgEscape(biome?.name || "Area")} \u2014 ${health}% health \xB7 ${placements.length} placed</text>`
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
}
function svgDataUri(svg) {
  const B = globalThis.Buffer;
  return "data:image/svg+xml;base64," + B.from(svg, "utf8").toString("base64");
}
async function biomeMetrics(playerId, opts = {}) {
  const t2 = db();
  const d = await defs();
  const states = await byPlayer(t2.BiomeState, playerId);
  const byId = new Map(states.map((s) => [s.biomeId, s]));
  const placements = opts.images ? await byPlayer(t2.Placement, playerId) : [];
  const terrain = opts.images ? await byPlayer(t2.TerrainTile, playerId) : [];
  const biomes = d.biomes.map((b) => {
    const s = byId.get(b.id) || {};
    const entry = {
      biomeId: b.id,
      name: b.name,
      health: s.health || 0,
      balance: s.balance || 0,
      returnedCount: s.returnedCount || 0,
      unlocked: !!s.unlocked,
      explorable: !!b.explorable
    };
    if (opts.images && s.unlocked) {
      const pls = placements.filter((p) => p.area === b.id);
      const ter = terrain.filter((tt) => tt.area === b.id);
      entry.placements = pls.length;
      entry.snapshot = svgDataUri(renderBiomeSVG(d, b, entry.health, pls, ter));
    }
    return entry;
  });
  return { biomes, summary: summarizeBiomes(biomes) };
}
function summarizeBiomes(rows) {
  const unlocked = rows.filter((r) => r.unlocked);
  return {
    biomesUnlocked: unlocked.length,
    biomesFullyRestored: unlocked.filter((r) => (r.health || 0) >= 100).length,
    avgHealth: unlocked.length ? Math.round(unlocked.reduce((a, r) => a + (r.health || 0), 0) / unlocked.length) : 0,
    totalAnimalsReturned: rows.reduce((a, r) => a + (r.returnedCount || 0), 0)
  };
}
async function createPlayerRecords(playerId, name, passcode, appearance, tzOffsetMinutes = 0) {
  const t2 = db();
  const d = await defs();
  const now = Date.now();
  const { salt, hash } = hashPasscode(passcode);
  const player = {
    id: playerId,
    name,
    passcodeSalt: salt,
    passcodeHash: hash,
    appearance,
    tzOffsetMinutes,
    // local-morning task resets (see playerDayKey)
    createdAt: now,
    worldId: playerId,
    // start in your own private solo world (world of one)
    area: "meadow",
    x: 24.5,
    // spawn right beside the camp crafting station
    y: 6.5,
    inventory: { ...START_INVENTORY },
    craftedItems: {},
    tools: { ...START_TOOLS },
    unlockedBiomes: ["meadow"],
    visitedBiomes: ["meadow"],
    // areas walked into at least once (enables fast-travel)
    tutorialStep: 0,
    home: { ...DEFAULT_HOME },
    // your camp tent — upgrade it along four tracks, in two styles
    metrics: freshMetrics(now),
    // The board always shows a live "Unlock the next biome" guidance goal, so a
    // new player starts with no custom goals of their own yet.
    customGoals: []
  };
  await t2.Player.put(player);
  const wid = playerId;
  const biomeStates = d.biomes.map((b) => ({
    id: `${wid}:${b.id}`,
    worldId: wid,
    playerId,
    biomeId: b.id,
    health: BASE_HEALTH,
    balance: 0,
    returnedCount: 0,
    unlocked: b.id === "meadow"
  }));
  for (const bs of biomeStates) await t2.BiomeState.put(bs);
  const chestPlacementId = `pl_${playerId}_starter-chest`;
  const placements = [
    {
      id: chestPlacementId,
      worldId: wid,
      playerId,
      objectId: "small-chest",
      area: "meadow",
      x: STARTER_CHEST.x,
      y: STARTER_CHEST.y,
      placedAt: now
    }
  ];
  for (const p of placements) await t2.Placement.put(p);
  const chest = {
    id: chestPlacementId,
    worldId: wid,
    playerId,
    area: "meadow",
    x: STARTER_CHEST.x,
    y: STARTER_CHEST.y,
    size: "small-chest",
    capacity: STARTER_CHEST.capacity,
    contents: {}
  };
  await t2.Chest.put(chest);
  return { player, seeded: { biomeStates, placements, chests: [chest] } };
}
async function freshSnapshot(created) {
  const now = Date.now();
  const d = await defs();
  const worldId = created.player?.worldId || created.player?.id;
  const wxTime = weatherTimeFromPlay(created.player);
  return {
    player: sanitizePlayer(created.player),
    biomeStates: created.seeded.biomeStates,
    placements: created.seeded.placements,
    chests: created.seeded.chests,
    discoveries: [],
    nodeStates: [],
    terrain: [],
    achievements: [],
    feed: [],
    serverTime: now,
    weather: weatherSnapshot(worldId, wxTime, WEATHER_BIOME_IDS),
    dailyTasks: dailyTasksBlock({ wid: worldId, player: created.player, d, discoveries: [], biomeStates: created.seeded.biomeStates, placements: created.seeded.placements, chests: created.seeded.chests, now }),
    customGoals: created.player.customGoals || [],
    goalLimit: goalLimitFor(created.player, d),
    nodeRegenSeconds: NODE_REGEN_SECONDS,
    inventoryCapacity: inventoryCapacity(created.player)
  };
}
function inventoryCapacity(player) {
  const tier = player.tools?.basket || 1;
  return (CAPACITY_BY_BASKET[tier] || 200) + homeCarryBonus(player);
}
function placementCounts(placements, d) {
  const now = Date.now();
  const counts = {};
  for (const p of placements) {
    if (d && p.plantedAt) {
      const def = d.object.get(p.objectId);
      const growMs = (def?.growSeconds || 0) * 1e3;
      if (growMs > 0 && now - p.plantedAt < growMs) continue;
    }
    counts[p.objectId] = (counts[p.objectId] || 0) + 1;
  }
  return counts;
}
var HEALTH_SCALE = 90;
function healthFromPoints(points) {
  const recovered = (100 - BASE_HEALTH) * (1 - Math.exp(-Math.max(0, points) / HEALTH_SCALE));
  return clamp(Math.round(BASE_HEALTH + recovered), 0, 100);
}
function matureMs(def) {
  return (def?.matureHours || 0) * 36e5;
}
function isMature(def, p, now) {
  const ms = matureMs(def);
  return ms > 0 && now - (p.placedAt || 0) >= ms;
}
function maturedBetween(def, p, a, b) {
  const ms = matureMs(def);
  if (ms <= 0) return false;
  const at = (p.placedAt || 0) + ms;
  return at > a && at <= b;
}
var MATURE_POINTS_CAP = 8;
function computeHealthPoints(d, placements, openWaterTiles = 0, now = Date.now()) {
  let points = 0;
  let maturePoints = 0;
  for (const p of placements) {
    const def = d.object.get(p.objectId);
    if (!def) continue;
    points += def.healthValue || 0;
    if (isMature(def, p, now)) maturePoints += def.matureBonus || 0;
  }
  points += Math.min(maturePoints, MATURE_POINTS_CAP);
  if (openWaterTiles > 0) points += 2 * Math.min(openWaterTiles, 7);
  return points;
}
var BALANCE_RETURN_WEIGHT = 0.45;
var BALANCE_WEB_WEIGHT = 0.35;
var BALANCE_BREADTH_WEIGHT = 0.2;
function computeBalance(d, biomeId, returnedIds) {
  const animals = d.animals.filter((a) => a.biome === biomeId);
  const total = animals.length;
  if (total === 0) return 0;
  const back = animals.filter((a) => returnedIds.has(a.id));
  if (back.length >= total) return 100;
  const returnFrac = back.length / total;
  const predators = animals.filter((a) => (a.requirements?.animals || []).length > 0);
  const predatorsBack = predators.filter((a) => returnedIds.has(a.id)).length;
  const webFrac = predators.length ? predatorsBack / predators.length : 1;
  const kindsAll = new Set(animals.map((a) => a.kind));
  const kindsBack = new Set(back.map((a) => a.kind));
  const breadthFrac = kindsAll.size ? kindsBack.size / kindsAll.size : 0;
  const raw = BALANCE_RETURN_WEIGHT * returnFrac + BALANCE_WEB_WEIGHT * webFrac + BALANCE_BREADTH_WEIGHT * breadthFrac;
  return clamp(Math.round(raw * 100), 0, 99);
}
function analyzeWater(terrain) {
  const cells = new Set(terrain.filter((t2) => t2.type === "water").map((t2) => `${t2.x},${t2.y}`));
  const seen = /* @__PURE__ */ new Set();
  let lake = 0;
  let river = 0;
  for (const key of cells) {
    if (seen.has(key)) continue;
    const stack = [key];
    seen.add(key);
    let size = 0;
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    while (stack.length) {
      const [x, y] = stack.pop().split(",").map(Number);
      size++;
      minx = Math.min(minx, x);
      maxx = Math.max(maxx, x);
      miny = Math.min(miny, y);
      maxy = Math.max(maxy, y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = `${x + dx},${y + dy}`;
        if (cells.has(nk) && !seen.has(nk)) {
          seen.add(nk);
          stack.push(nk);
        }
      }
    }
    lake = Math.max(lake, size);
    river = Math.max(river, Math.max(maxx - minx + 1, maxy - miny + 1));
  }
  return { tiles: cells.size, lake, river };
}
function meetsConditions(animal, wx) {
  const cond = animal.requirements?.conditions;
  if (!cond) return true;
  if (!wx) return false;
  if (Array.isArray(cond.weather) && cond.weather.length && !cond.weather.includes(wx.type)) return false;
  if (Array.isArray(cond.season) && cond.season.length && !cond.season.includes(wx.season)) return false;
  if (Array.isArray(cond.dayPhase) && cond.dayPhase.length && !cond.dayPhase.includes(wx.dayPhase)) return false;
  return true;
}
function meetsRequirements(animal, health, balance, counts, returnedIds, water, wx = null) {
  const req = animal.requirements || {};
  if (health < (req.minHealth || 0)) return false;
  if (balance < (req.minBalance || 0)) return false;
  if (!meetsConditions(animal, wx)) return false;
  for (const [objectId, qty] of Object.entries(req.objects || {})) {
    if ((counts[objectId] || 0) < qty) return false;
  }
  for (const other of req.animals || []) {
    if (!returnedIds.has(other)) return false;
  }
  const w = req.water;
  if (w) {
    if ((water.tiles || 0) < (w.tiles || 0)) return false;
    if ((water.lake || 0) < (w.lake || 0)) return false;
    if ((water.river || 0) < (w.river || 0)) return false;
  }
  return true;
}
function computeComfort(animal, counts) {
  const req = animal.requirements?.objects || {};
  const liked = Object.keys(req);
  if (!liked.length) return 70;
  let comfort = 30;
  let missing = 0;
  let extras = 0;
  for (const [objectId, qty] of Object.entries(req)) {
    const have = counts[objectId] || 0;
    if (have >= qty) {
      comfort += Math.round(30 / liked.length);
      extras += have - qty;
    } else {
      missing++;
    }
  }
  comfort += Math.round(40 * (1 - Math.exp(-extras / 6)));
  comfort -= missing * 25;
  return clamp(comfort, 5, 100);
}
function whyReturnedText(animal, d) {
  const req = animal.requirements || {};
  const parts = [];
  const objs = Object.entries(req.objects || {}).map(([id, q]) => t("server.whyReturned.objectQty", { qty: q, name: d.object.get(id)?.name || id }));
  if (objs.length) parts.push(t("server.whyReturned.habitat", { objects: objs.join(t("server.list.comma")) }));
  if (req.water) {
    const w = req.water;
    if (w.lake) parts.push(t("server.whyReturned.lake", { tiles: w.lake }));
    else if (w.river) parts.push(t("server.whyReturned.river", { tiles: w.river }));
    else if (w.tiles) parts.push(t("server.whyReturned.tiles", { tiles: w.tiles }));
  }
  if (req.minHealth) parts.push(t("server.whyReturned.health", { health: req.minHealth }));
  if (req.minBalance) parts.push(t("server.whyReturned.balance", { balance: req.minBalance }));
  if (req.animals?.length) parts.push(t("server.whyReturned.animals", { animals: req.animals.map((a) => d.animal.get(a)?.name || a).join(t("server.list.and")) }));
  const cond = req.conditions;
  if (cond) {
    const bits = [];
    if (cond.weather?.length) bits.push(cond.weather.join(t("server.list.or")));
    if (cond.season?.length) bits.push(t("server.whyReturned.inSeason", { seasons: cond.season.join(t("server.list.or")) }));
    if (cond.dayPhase?.length) bits.push(t("server.whyReturned.atPhase", { phases: cond.dayPhase.join(t("server.list.or")) }));
    if (bits.length) parts.push(t("server.whyReturned.moment", { conditions: bits.join(t("server.list.comma")) }));
  }
  return t("server.whyReturned.sentence", { reasons: parts.join(t("server.list.comma")) });
}
async function recalcBiome(wid, playerId, biomeId, opts = {}) {
  const t2 = db();
  const d = await defs();
  if (!d.biome.get(biomeId)) throw new GameError(t("server.err.unknownBiome", { biome: biomeId }));
  let placements = (await byWorld(t2.Placement, wid)).filter((p) => p.area === biomeId);
  if (opts.removeIds?.length) placements = placements.filter((p) => !opts.removeIds.includes(p.id));
  for (const ap of opts.addPlacements || []) {
    if (ap.area !== biomeId) continue;
    placements = placements.filter((p) => p.id !== ap.id);
    placements.push(ap);
  }
  const counts = placementCounts(placements, d);
  let terrain = (await byWorld(t2.TerrainTile, wid)).filter((tt) => tt.area === biomeId);
  if (opts.removeTerrainIds?.length) terrain = terrain.filter((tt) => !opts.removeTerrainIds.includes(tt.id));
  for (const at of opts.addTerrain || []) {
    if (at.area !== biomeId) continue;
    terrain = terrain.filter((tt) => tt.id !== at.id);
    terrain.push(at);
  }
  const wateredTiles = Math.min(3, terrain.filter((tt) => tt.type === "watered").length) * 0.5;
  const openWaterTiles = terrain.filter((tt) => tt.type === "water" && !tt.seeded).length;
  const water = analyzeWater(terrain);
  const now = Date.now();
  const healthPoints = computeHealthPoints(d, placements, openWaterTiles, now) + wateredTiles;
  const health = healthFromPoints(healthPoints);
  const actor = opts.player || await safeGet(t2.Player, playerId);
  const wxTime = actor ? weatherTimeFromPlay(actor) : null;
  const wx = wxTime === null ? null : {
    type: weatherTypeAt(wid, biomeId, wxTime),
    season: seasonAt(wxTime),
    dayPhase: dayPhaseAt(wxTime)
  };
  const discoveries = await byWorld(t2.Discovery, wid);
  const returnedIds = new Set(discoveries.map((x) => x.animalId));
  let balance = computeBalance(d, biomeId, returnedIds);
  const newAnimals = [];
  const biomeAnimals = d.animals.filter((a) => a.biome === biomeId);
  const firstAnimalBack = returnedIds.has(FIRST_ANIMAL_ID);
  for (const animal of biomeAnimals) {
    if (returnedIds.has(animal.id)) continue;
    if (!firstAnimalBack && animal.id !== FIRST_ANIMAL_ID) continue;
    if (meetsRequirements(animal, health, balance, counts, returnedIds, water, wx)) {
      const disc = {
        id: `${wid}:${animal.id}`,
        worldId: wid,
        playerId,
        animalId: animal.id,
        biomeId,
        comfort: computeComfort(animal, counts),
        timesObserved: 0,
        firstObservedAt: Date.now(),
        whyReturned: whyReturnedText(animal, d)
      };
      await t2.Discovery.put(disc);
      returnedIds.add(animal.id);
      balance = computeBalance(d, biomeId, returnedIds);
      newAnimals.push({ ...disc, animal });
      break;
    }
  }
  for (const disc of discoveries) {
    if (disc.biomeId !== biomeId) continue;
    const animal = d.animal.get(disc.animalId);
    if (!animal) continue;
    const comfort = computeComfort(animal, counts);
    if (comfort !== disc.comfort) await t2.Discovery.patch(disc.id, { comfort });
  }
  const returnedCount = [...returnedIds].filter((id) => d.animal.get(id)?.biome === biomeId).length;
  const prior = await findBiomeState(t2.BiomeState, wid, biomeId);
  const bsId = prior?.id ?? `${wid}:${biomeId}`;
  await t2.BiomeState.patch(bsId, { health, balance, returnedCount });
  const biomeState = {
    ...prior || { id: bsId, worldId: wid, playerId, biomeId, unlocked: biomeId === "meadow" },
    health,
    balance,
    returnedCount
  };
  const healthGain = health - (prior?.health ?? BASE_HEALTH);
  const dailyDeltas = {};
  if (healthGain > 0) dailyDeltas[`health:${biomeId}`] = healthGain;
  if (newAnimals.length) {
    dailyDeltas[`animal:${biomeId}`] = newAnimals.length;
    dailyDeltas.animal = newAnimals.length;
  }
  if (Object.keys(dailyDeltas).length) {
    const actor2 = opts.player || await t2.Player.get(playerId);
    if (actor2) await bumpMetrics(actor2, {}, dailyDeltas);
  }
  const unlockedBiomes = await checkUnlocks(wid, playerId, { player: opts.player, freshState: biomeState });
  return { biomeState, newAnimals, unlockedBiomes };
}
var STARTING_TERRAIN = {
  wetland: [
    // a winding river across the north
    ...[6, 7, 8, 9, 10, 11, 12, 13, 14].map((x) => ({ x, y: 4, type: "water" })),
    { x: 14, y: 5, type: "water" },
    { x: 14, y: 6, type: "water" },
    { x: 15, y: 6, type: "water" },
    // a small open pond
    { x: 20, y: 6, type: "water" },
    { x: 21, y: 6, type: "water" },
    { x: 22, y: 6, type: "water" },
    { x: 20, y: 7, type: "water" },
    { x: 21, y: 7, type: "water" },
    { x: 22, y: 7, type: "water" },
    // a couple of watered beds ready to plant
    { x: 10, y: 14, type: "watered" },
    { x: 11, y: 14, type: "watered" }
  ]
};
async function seedStartingTerrain(wid, playerId, biomeId) {
  const layout = STARTING_TERRAIN[biomeId];
  if (!layout) return;
  const t2 = db();
  for (const cell of layout) {
    const id = `${wid}:${biomeId}:${cell.x}:${cell.y}`;
    if (await t2.TerrainTile.get(id)) continue;
    await t2.TerrainTile.put({ id, worldId: wid, playerId, area: biomeId, x: cell.x, y: cell.y, type: cell.type, seeded: true, updatedAt: Date.now() });
  }
}
async function checkUnlocks(wid, playerId, fresh = {}) {
  const t2 = db();
  const d = await defs();
  const player = fresh.player || await t2.Player.get(playerId);
  const unlockedNow = [];
  const unlockedSet = new Set(player.unlockedBiomes || []);
  const pendingRewards = new Set(player.pendingUnlockRewards || []);
  const worldUnlocked = new Set((await byWorld(t2.BiomeState, wid)).filter((b) => b.unlocked).map((b) => b.biomeId));
  for (const biome of d.biomes) {
    if (!biome.unlock || worldUnlocked.has(biome.id)) continue;
    const u = biome.unlock;
    const prereq = fresh.freshState?.biomeId === u.biome ? fresh.freshState : await findBiomeState(t2.BiomeState, wid, u.biome);
    if (!prereq || !worldUnlocked.has(u.biome)) continue;
    if ((prereq.health || 0) < (u.minHealth || 0)) continue;
    if ((prereq.returnedCount || 0) < (u.minAnimals || 0)) continue;
    if (u.minTotalAnimals) {
      const totalReturned = (await byWorld(t2.Discovery, wid)).length;
      if (totalReturned < u.minTotalAnimals) continue;
    }
    if (u.requiresItem) {
      const crafted = player.craftedItems?.[u.requiresItem] || 0;
      const everCrafted = player.craftedEver?.[u.requiresItem] || 0;
      if (crafted <= 0 && everCrafted <= 0) continue;
    }
    if (u.requiresTool && (player.tools?.[u.requiresTool.id] || 1) < u.requiresTool.tier) continue;
    worldUnlocked.add(biome.id);
    unlockedSet.add(biome.id);
    pendingRewards.add(biome.id);
    await t2.Player.patch(playerId, { unlockedBiomes: [...unlockedSet], pendingUnlockRewards: [...pendingRewards] });
    const bsRow = await findBiomeState(t2.BiomeState, wid, biome.id);
    await t2.BiomeState.patch(bsRow?.id ?? `${wid}:${biome.id}`, { unlocked: true });
    await seedStartingTerrain(wid, playerId, biome.id);
    unlockedNow.push({ id: biome.id, name: biome.name });
  }
  return unlockedNow;
}
function recipeUnlockMet(recipe, ctx) {
  const u = recipe.unlock;
  if (!u) return true;
  if (typeof u.minHealth === "number" && ctx.health < u.minHealth) return false;
  if (typeof u.animalsReturned === "number" && ctx.animalsReturned < u.animalsReturned) return false;
  if (u.requiresAnimal && !ctx.returnedAnimalIds.has(u.requiresAnimal)) return false;
  if (u.requiresCrafted && (ctx.craftedEver?.[u.requiresCrafted] || 0) <= 0) return false;
  return true;
}
async function recipeUnlockContext(wid, biomeId, player, d) {
  const t2 = db();
  const bs = await findBiomeState(t2.BiomeState, wid, biomeId);
  const discoveries = await byWorld(t2.Discovery, wid);
  const returnedAnimalIds = new Set(
    discoveries.filter((x) => d.animal.get(x.animalId)?.biome === biomeId).map((x) => x.animalId)
  );
  return {
    health: bs?.health || 0,
    animalsReturned: returnedAnimalIds.size,
    returnedAnimalIds,
    craftedEver: player.craftedEver || {}
  };
}
async function getOwnedChest(t2, d, chestId, wid) {
  const chest = await findInWorld(t2.Chest, wid, chestId);
  if (chest) return chest;
  const placement = await findInWorld(t2.Placement, wid, chestId);
  if (placement) {
    const def = d.object.get(placement.objectId);
    if (def?.isChest) {
      const healed = {
        id: chestId,
        worldId: wid,
        playerId: placement.playerId,
        area: placement.area,
        x: placement.x,
        y: placement.y,
        size: placement.objectId,
        capacity: def.chestCapacity || 60,
        contents: {}
      };
      await t2.Chest.put(healed);
      return healed;
    }
  }
  return null;
}
async function consumeMaterials(player, materials, wid = player.id) {
  const t2 = db();
  const chests = await byWorld(t2.Chest, wid);
  for (const [resId, qty] of Object.entries(materials)) {
    const inInv = player.inventory?.[resId] || 0;
    const inChests = chests.reduce((sum, c) => sum + (c.contents?.[resId] || 0), 0);
    if (inInv + inChests < qty) {
      throw new GameError(t("server.err.notEnough", { resource: resId, need: qty, have: inInv + inChests }));
    }
  }
  const usedFrom = { inventory: {}, chests: {} };
  const inventory = { ...player.inventory || {} };
  const chestContents = new Map(chests.map((c) => [c.id, { ...c.contents || {} }]));
  for (const [resId, qtyNeeded] of Object.entries(materials)) {
    let remaining = qtyNeeded;
    const fromInv = Math.min(inventory[resId] || 0, remaining);
    if (fromInv > 0) {
      inventory[resId] -= fromInv;
      if (inventory[resId] <= 0) delete inventory[resId];
      usedFrom.inventory[resId] = fromInv;
      remaining -= fromInv;
    }
    for (const chest of chests) {
      if (remaining <= 0) break;
      const contents = chestContents.get(chest.id);
      const fromChest = Math.min(contents[resId] || 0, remaining);
      if (fromChest > 0) {
        contents[resId] -= fromChest;
        if (contents[resId] <= 0) delete contents[resId];
        usedFrom.chests[chest.id] = usedFrom.chests[chest.id] || {};
        usedFrom.chests[chest.id][resId] = fromChest;
        remaining -= fromChest;
      }
    }
    if (remaining > 0) throw new GameError(t("server.err.notEnoughShort", { resource: resId }));
  }
  await t2.Player.patch(player.id, { inventory });
  for (const chest of chests) {
    if (usedFrom.chests[chest.id]) {
      await t2.Chest.patch(chest.id, { contents: chestContents.get(chest.id) });
    }
  }
  return { usedFrom, inventory };
}
var GOAL_ICON = {
  craft: "hammer",
  build: "hammer",
  grow: "leaf",
  plant: "leaf",
  collect: "basket",
  observe: "journal",
  welcome: "paw",
  attract: "paw",
  welcomeTotal: "paw",
  home: "home",
  unlock: "map",
  health: "leaf",
  biomeAnimals: "paw"
};
var GOAL_HOME_TRACKS = ["space", "comfort", "decor", "light"];
var MAX_CUSTOM_GOALS = 6;
function goalLimitFor(player, d) {
  const unlocked = new Set(player?.unlockedBiomes || ["meadow"]);
  const allOpen = d.biomes.filter((b) => b.explorable).every((b) => unlocked.has(b.id));
  return allOpen ? 6 : 3;
}
function nextBiomeGoal(ctx) {
  const { d, biomeStates, discoveries, player } = ctx;
  const bs = new Map(biomeStates.map((b) => [b.biomeId, b]));
  for (const biome of d.biomes) {
    const u = biome.unlock;
    if (!u || bs.get(biome.id)?.unlocked) continue;
    const prereq = bs.get(u.biome);
    if (!prereq?.unlocked) continue;
    if (!(player?.visitedBiomes || ["meadow"]).includes(u.biome)) continue;
    const prereqName = d.biome.get(u.biome)?.name || u.biome;
    const name = d.biome.get(biome.id)?.name || biome.id;
    const steps = [];
    if (u.minHealth) steps.push({ text: t("server.nextbiome.health", { biome: prereqName, goal: u.minHealth, cur: Math.round(prereq.health || 0) }), done: (prereq.health || 0) >= u.minHealth });
    if (u.minAnimals) steps.push({ text: t("server.nextbiome.animals", { biome: prereqName, goal: u.minAnimals, cur: prereq.returnedCount || 0 }), done: (prereq.returnedCount || 0) >= u.minAnimals });
    if (u.minTotalAnimals) steps.push({ text: t("server.nextbiome.total", { goal: u.minTotalAnimals, cur: discoveries.length }), done: discoveries.length >= u.minTotalAnimals });
    if (u.requiresItem) {
      const item = d.object.get(u.requiresItem)?.name || u.requiresItem;
      const have = (player?.craftedItems?.[u.requiresItem] || 0) + (player?.craftedEver?.[u.requiresItem] || 0);
      steps.push({ text: t("server.nextbiome.craft", { item }), done: have > 0 });
    }
    if (!steps.length) return null;
    const done = steps.filter((s) => s.done).length;
    return {
      id: "next-biome",
      kind: "unlock",
      icon: "map",
      pinned: true,
      text: t("server.nextbiome.title", { biome: name }),
      hint: t("server.nextbiome.hint", { biome: name }),
      target: steps.length,
      progress: done,
      counter: "",
      reward: {},
      steps,
      claimed: false
    };
  }
  return null;
}
function attractSteps(animalId, ctx) {
  const a = ctx.d.animal.get(animalId);
  if (!a) return [];
  const needTier = (ctx.d.biome.get(a.biome)?.order || 1) + 1;
  const guideTier = ctx.player?.tools?.["field-journal"] || 1;
  if (guideTier < needTier) {
    return [{ text: t("server.goal.upgradeGuide"), done: false }];
  }
  const steps = [];
  for (const [oid, need] of Object.entries(a.requirements?.objects || {})) {
    const have = (ctx.placements || []).filter((p) => p.objectId === oid && p.area === a.biome).length;
    steps.push({ text: t("server.goal.habitatStep", { have: Math.min(have, need), need, name: ctx.d.object.get(oid)?.name || oid }), done: have >= need });
  }
  if (a.requirements?.minHealth) {
    const b = ctx.biomeStates.find((x) => x.biomeId === a.biome);
    const cur = Math.round(b?.health || 0);
    steps.push({ text: t("server.goal.healthStep", { cur, need: a.requirements.minHealth }), done: cur >= a.requirements.minHealth });
  }
  return steps;
}
function craftMaterialSteps(itemId, ctx) {
  const recipe = (ctx.d.recipes || []).find((r) => r.output?.itemId === itemId);
  return matSteps(recipe?.materials || {}, ctx);
}
function homeBuildSteps(styleId, ctx) {
  return matSteps(HOME_STYLES[styleId]?.materials || {}, ctx);
}
function matSteps(mats, ctx) {
  return Object.entries(mats).map(([mid, need]) => {
    const have = heldAmount(ctx, mid);
    return { text: t("server.goal.matStep", { have: Math.min(have, need), need, name: ctx.d.resource.get(mid)?.name || mid }), done: have >= need };
  });
}
function goalRewardPool(ctx) {
  const unlocked = ctx.unlockedBiomes?.length ? ctx.unlockedBiomes : ctx.player?.unlockedBiomes?.length ? ctx.player.unlockedBiomes : ["meadow"];
  const all = unlocked.flatMap((id) => ctx.d.biome.get(id)?.resources || []);
  return [...new Set(all)].filter((r) => r !== "water" && !isWeatherGatheredResource(r) && ctx.d.resource.get(r));
}
function goalReward(ctx, key) {
  const pool = goalRewardPool(ctx);
  const out = {};
  if (!pool.length) return out;
  const rng = seededRng(hash32(`goalreward:${key}`));
  const p = [...pool];
  for (let i = 0; i < 2 && p.length; i++) {
    const r = p.splice(Math.floor(rng() * p.length), 1)[0];
    out[r] = 3 + Math.floor(rng() * 3);
  }
  return out;
}
function unlockBundle(ctx, biomeId) {
  const pool = (ctx.d.biome.get(biomeId)?.resources || []).filter((r) => r !== "water" && !isWeatherGatheredResource(r) && ctx.d.resource.get(r));
  const out = {};
  if (!pool.length) return out;
  const rng = seededRng(hash32(`unlockreward:${biomeId}`));
  const p = [...pool];
  for (let i = 0; i < 2 && p.length; i++) {
    const r = p.splice(Math.floor(rng() * p.length), 1)[0];
    out[r] = 4 + Math.floor(rng() * 3);
  }
  return out;
}
function heldAmount(ctx, resId) {
  const inv = ctx.player?.inventory?.[resId] || 0;
  const inChests = (ctx.chests || []).reduce((s, c) => s + (c.contents?.[resId] || 0), 0);
  return inv + inChests;
}
function placedCountFor(ctx, objectId) {
  return (ctx.placements || []).filter((p) => p.objectId === objectId).length;
}
function plantedCountFor(ctx, objectId) {
  return (ctx.placements || []).filter((p) => p.objectId === objectId && typeof p.plantedAt === "number").length;
}
function goalMetric(goal, ctx) {
  switch (goal.kind) {
    case "craft":
    case "build":
      return ctx.player?.craftedEver?.[goal.itemId || ""] || 0;
    case "grow":
      return plantedCountFor(ctx, goal.itemId || "");
    case "plant":
      return (ctx.placements || []).filter((p) => typeof p.plantedAt === "number").length;
    case "collect":
      return heldAmount(ctx, goal.resourceId || "");
    case "observe":
      return ctx.discoveries.filter((x) => (x.timesObserved || 0) > 0).length;
    case "welcomeTotal":
      return ctx.discoveries.length;
    default:
      return 0;
  }
}
function goalProgress(goal, ctx) {
  switch (goal.kind) {
    case "craft":
    case "grow":
    case "plant":
    case "collect":
    case "observe":
    case "welcomeTotal":
      return Math.max(0, Math.min(goal.target, goalMetric(goal, ctx) - (goal.base || 0)));
    case "build": {
      const crafted = Math.max(0, Math.min(goal.target, (ctx.player?.craftedEver?.[goal.itemId || ""] || 0) - (goal.base || 0)));
      const placed = Math.max(0, Math.min(goal.target, placedCountFor(ctx, goal.itemId || "") - (goal.basePlace || 0)));
      return crafted + placed;
    }
    case "welcome":
    case "attract":
      return ctx.discoveries.some((x) => x.animalId === goal.animalId) ? 1 : 0;
    case "home":
      if (goal.track === "build") {
        const h = ctx.player?.home;
        if (!h?.styleLocked) return 0;
        return !goal.styleId || h.style === goal.styleId ? 1 : 0;
      }
      return ctx.player?.home?.[goal.track || ""] >= goal.target ? goal.target : Math.min(goal.target, ctx.player?.home?.[goal.track || ""] || 1);
    case "unlock":
      return ctx.biomeStates.some((b) => b.biomeId === goal.biomeId && b.unlocked) ? 1 : 0;
    case "health": {
      const b = ctx.biomeStates.find((x) => x.biomeId === goal.biomeId);
      return Math.min(goal.target, Math.round(b?.health || 0));
    }
    case "biomeAnimals": {
      const ret = ctx.discoveries.filter((d) => d.biomeId === goal.biomeId).length;
      return Math.min(goal.target, ret);
    }
    default:
      return 0;
  }
}
function goalText(goal, ctx) {
  const d = ctx.d;
  switch (goal.kind) {
    case "craft":
      return t("server.goal.craft", { count: goal.target, item: d.object.get(goal.itemId)?.name || goal.itemId });
    case "build":
      return t("server.goal.build", { count: goal.target, item: d.object.get(goal.itemId)?.name || goal.itemId });
    case "grow":
      return t("server.goal.grow", { count: goal.target, item: d.object.get(goal.itemId)?.name || goal.itemId });
    case "plant":
      return t("server.goal.plant", { count: goal.target });
    case "collect":
      return t("server.goal.collect", { count: goal.target, resource: d.resource.get(goal.resourceId)?.name || goal.resourceId });
    case "observe":
      return t("server.goal.observe", { count: goal.target });
    case "welcome":
      return t("server.goal.welcome", { animal: d.animal.get(goal.animalId)?.name || goal.animalId });
    case "attract":
      return t("server.goal.attract", { kind: d.animal.get(goal.animalId)?.kind || t("server.goal.creature") });
    case "welcomeTotal":
      return t("server.goal.welcomeTotal", { count: goal.target });
    case "home":
      return goal.track === "build" ? t("server.goal.buildHome", { style: HOME_STYLES[goal.styleId || ""]?.name || t("server.goal.aHouse") }) : t("server.goal.home", { track: t(`server.goal.track.${goal.track}`), level: goal.target });
    case "unlock":
      return t("server.goal.unlock", { biome: d.biome.get(goal.biomeId)?.name || goal.biomeId });
    case "health":
      return t("server.goal.restore", { biome: d.biome.get(goal.biomeId)?.name || goal.biomeId, pct: goal.target });
    case "biomeAnimals":
      return t("server.goal.biomeAnimals", { count: goal.target, biome: d.biome.get(goal.biomeId)?.name || goal.biomeId });
    default:
      return "";
  }
}
function starterTasks(ctx) {
  const grasshopper = ctx.discoveries.some((x) => x.animalId === FIRST_ANIMAL_ID);
  const craftedAny = Object.keys(ctx.player?.craftedEver || {}).length > 0;
  return [
    { id: "start-gather", kind: "gather", icon: "basket", text: t("server.task.collectSeeds"), hint: t("server.task.gatherHint"), target: 12, progress: Math.min(12, heldAmount(ctx, "seeds")) },
    { id: "start-craft", kind: "craft", icon: "hammer", text: t("server.task.craftFirst"), hint: t("server.task.craftFirstHint"), target: 1, progress: craftedAny ? 1 : 0 },
    { id: "start-welcome", kind: "welcome", icon: "sparkle", text: t("server.task.welcomeGrasshopper"), hint: t("server.task.welcomeGrasshopperHint"), target: 1, progress: grasshopper ? 1 : 0 }
  ];
}
function sanitizeGoals(goals, d) {
  const out = [];
  const kinds = ["craft", "build", "grow", "plant", "collect", "observe", "welcome", "attract", "welcomeTotal", "home", "unlock", "health", "biomeAnimals"];
  let hasHome = false;
  for (const g of Array.isArray(goals) ? goals : []) {
    if (out.length >= MAX_CUSTOM_GOALS) break;
    const kind = g?.kind;
    if (!kinds.includes(kind)) continue;
    if (kind === "home") {
      if (hasHome) continue;
      hasHome = true;
    }
    const id = typeof g?.id === "string" && g.id ? g.id.slice(0, 40) : `cg_${Math.random().toString(36).slice(2, 10)}`;
    const target = Math.max(1, Math.min(99, Math.floor(Number(g?.target) || 1)));
    const goal = { id, kind, target };
    if (kind === "craft" || kind === "build" || kind === "grow") {
      if (!d.object.get(g?.itemId)) continue;
      goal.itemId = g.itemId;
    } else if (kind === "collect") {
      if (!d.resource.get(g?.resourceId)) continue;
      goal.resourceId = g.resourceId;
    } else if (kind === "welcome" || kind === "attract") {
      if (!d.animal.get(g?.animalId)) continue;
      goal.animalId = g.animalId;
      goal.target = 1;
    } else if (kind === "home") {
      if (g?.track === "build") {
        if (!HOME_STYLES[g?.styleId]) continue;
        goal.track = "build";
        goal.styleId = g.styleId;
        goal.target = 1;
      } else {
        if (!GOAL_HOME_TRACKS.includes(g?.track)) continue;
        goal.track = g.track;
      }
    } else if (kind === "unlock") {
      if (!d.biome.get(g?.biomeId)) continue;
      goal.biomeId = g.biomeId;
      goal.target = 1;
    } else if (kind === "health") {
      if (!d.biome.get(g?.biomeId)) continue;
      goal.biomeId = g.biomeId;
      goal.target = Math.max(1, Math.min(100, Math.floor(Number(g?.target) || 100)));
    } else if (kind === "biomeAnimals") {
      if (!d.biome.get(g?.biomeId)) continue;
      const n = d.animals.filter((a) => a.biome === g.biomeId).length;
      if (n <= 0) continue;
      goal.biomeId = g.biomeId;
      goal.target = n;
    }
    out.push(goal);
  }
  return out;
}
function dailyTasksBlock(ctx) {
  const { player, now, d } = ctx;
  const dayKey = playerDayKey(player, now);
  const goalClaims = player?.goalClaims || {};
  const tasks = [];
  const pendingUnlock = player?.pendingUnlockRewards || [];
  if (!pendingUnlock.length) {
    const nb = nextBiomeGoal(ctx);
    if (nb) tasks.push(nb);
  }
  for (const bid of pendingUnlock) {
    const bname = d.biome.get(bid)?.name || bid;
    tasks.push({
      id: `unlock-reward:${bid}`,
      kind: "unlock",
      icon: "sparkle",
      text: t("server.unlockreward.title", { biome: bname }),
      hint: t("server.unlockreward.hint", { biome: bname }),
      target: 1,
      progress: 1,
      counter: "",
      reward: unlockBundle(ctx, bid),
      claimed: false
    });
  }
  for (const s of starterTasks(ctx)) {
    if (goalClaims[s.id]) continue;
    tasks.push({ ...s, counter: "", reward: goalReward(ctx, s.id), claimed: false });
  }
  for (const g of player?.customGoals || []) {
    if (goalClaims[g.id]) continue;
    const target = g.kind === "build" ? g.target * 2 : g.target;
    const steps = g.kind === "attract" ? attractSteps(g.animalId || "", ctx) : g.kind === "craft" || g.kind === "build" ? craftMaterialSteps(g.itemId || "", ctx) : g.kind === "home" && g.track === "build" ? homeBuildSteps(g.styleId || "", ctx) : void 0;
    tasks.push({
      id: g.id,
      kind: g.kind,
      icon: GOAL_ICON[g.kind] || "check",
      text: goalText(g, ctx),
      target,
      counter: "",
      reward: goalReward(ctx, g.id),
      progress: goalProgress(g, ctx),
      claimed: false,
      hint: t(`server.goal.hint.${g.kind}`),
      ...steps ? { steps } : {}
    });
  }
  return { dayKey, endsAt: 0, tasks };
}
async function snapshot(playerId, opts = {}) {
  const t2 = db();
  const d = await defs();
  let player = await safeGet(t2.Player, playerId);
  const areaBiome = d.biome.get(player?.area);
  if (player && player.area !== "home" && (!areaBiome || !areaBiome.explorable)) {
    player = { ...player, area: "meadow", x: 24.5, y: 6.5 };
  }
  const wid = opts.worldId || worldOf(player);
  const [biomeStates, placements, chests, discoveries, nodeStates, terrain, achievementRows, feedRows] = await Promise.all([
    byWorld(t2.BiomeState, wid),
    byWorld(t2.Placement, wid),
    byWorld(t2.Chest, wid),
    byWorld(t2.Discovery, wid),
    byWorld(t2.NodeState, wid),
    byWorld(t2.TerrainTile, wid),
    byPlayer(t2.PlayerAchievement, playerId),
    byWorld(t2.FeedEntry, wid)
  ]);
  const personalUnlocked = [...player?.unlockedBiomes?.length ? player.unlockedBiomes : ["meadow"]];
  if (player && wid !== player.id) {
    const unlocked = new Set(player.unlockedBiomes || ["meadow"]);
    for (const bs of biomeStates) if (bs.unlocked) unlocked.add(bs.biomeId);
    player = { ...player, unlockedBiomes: [...unlocked] };
  }
  const now = Date.now();
  const wxTime = weatherTimeFromPlay(player);
  return {
    player: sanitizePlayer(player),
    worldId: wid,
    biomeStates,
    placements,
    chests,
    discoveries,
    nodeStates,
    terrain,
    // most-recently earned first, so the client can float fresh unlocks to the top
    achievements: [...achievementRows].sort((a, b) => (b.earnedAt || 0) - (a.earnedAt || 0)).map((r) => r.achievementId),
    // persisted activity feed, oldest→newest (last 100 kept per player)
    feed: [...feedRows].sort((a, b) => (a.at || 0) - (b.at || 0)).slice(-FEED_CAP).map((r) => ({ id: r.id, at: r.at, icon: r.icon, text: r.text })),
    serverTime: now,
    weather: weatherSnapshot(wid, wxTime, WEATHER_BIOME_IDS, player?.devWeather || null),
    dailyTasks: dailyTasksBlock({ wid, player, d, discoveries, biomeStates, placements, chests, now, unlockedBiomes: personalUnlocked }),
    customGoals: player?.customGoals || [],
    goalLimit: goalLimitFor(player, d),
    nodeRegenSeconds: NODE_REGEN_SECONDS,
    inventoryCapacity: inventoryCapacity(player)
  };
}
async function bodyOf(data) {
  const body = await data;
  if (!body || typeof body !== "object") throw new GameError(t("server.err.bodyRequired"));
  return body;
}
var ACHIEVEMENT_TRIGGERS = {
  // Earned the moment the grasshopper comes home — the payoff of the whole
  // starter loop (you can only get here by gathering, crafting, and placing).
  "welcome-grasshopper": (c) => !!c.disc("grasshopper"),
  forager: (c) => (c.counts.resourcesCollected || 0) >= 100,
  "makers-hands": (c) => (c.counts.itemsCrafted || 0) >= 10,
  "green-thumb": (c) => (c.counts.plantsPlanted || 0) >= 10,
  waterworks: (c) => (c.counts.terraformActions || 0) >= 15,
  "meadow-first-bloom": (c) => c.returned("meadow") >= 8,
  "meadow-pollinators": (c) => c.kindReturned("meadow", "insect") >= 5,
  "meadow-apex": (c) => !!c.disc("red-fox-meadow"),
  "meadow-mender": (c) => c.health("meadow") >= 80,
  "meadow-reborn": (c) => c.returned("meadow") >= 25,
  "forest-understory": (c) => c.returned("forest") >= 10,
  "forest-cavities": (c) => !!c.disc("pileated-woodpecker") && (!!c.disc("wood-duck") || !!c.disc("northern-flying-squirrel") || !!c.disc("great-horned-owl") || !!c.disc("barred-owl")),
  "forest-night-shift": (c) => !!c.disc("great-horned-owl") && !!c.disc("barred-owl") && !!c.disc("little-brown-bat"),
  "forest-canopy": (c) => c.health("forest") >= 80,
  "forest-reborn": (c) => c.returned("forest") >= 25,
  "wetland-first-water": (c) => c.returned("wetland") >= 8,
  "wetland-engineer": (c) => !!c.disc("beaver"),
  "wetland-lakemaker": (c) => c.water("wetland").lake >= 6,
  "wetland-restored": (c) => c.health("wetland") >= 80,
  "wetland-reborn": (c) => c.returned("wetland") >= 25,
  "desert-first-life": (c) => c.returned("desert") >= 8,
  "desert-burrows": (c) => !!c.disc("burrowing-owl") && !!c.disc("kangaroo-rat") && !!c.disc("desert-tortoise"),
  "desert-hunter": (c) => !!c.disc("rattlesnake") || !!c.disc("coyote"),
  "desert-restored": (c) => c.health("desert") >= 80,
  "desert-reborn": (c) => c.returned("desert") >= 25,
  "alpine-treeline": (c) => c.returned("alpine") >= 8,
  "alpine-haypile": (c) => !!c.disc("pika"),
  "alpine-crown": (c) => !!c.disc("golden-eagle"),
  "alpine-restored": (c) => c.health("alpine") >= 80,
  "alpine-reborn": (c) => c.returned("alpine") >= 25,
  "coastal-tide": (c) => c.returned("coastal") >= 8,
  "coastal-keystone": (c) => !!c.disc("sea-star"),
  "coastal-otter": (c) => !!c.disc("sea-otter"),
  "coastal-restored": (c) => c.health("coastal") >= 80,
  "coastal-reborn": (c) => c.returned("coastal") >= 25,
  "well-stocked": (c) => (c.counts.resourcesCollected || 0) >= 1e3,
  "master-builder": (c) => (c.counts.objectsPlaced || 0) >= 150,
  "master-gardener": (c) => (c.counts.plantsPlanted || 0) >= 75,
  landscaper: (c) => (c.counts.terraformActions || 0) >= 150,
  "fully-equipped": (c) => c.tool("basket") >= 4 && c.tool("shovel") >= 4 && c.tool("watering-can") >= 4,
  naturalist: (c) => c.tool("field-journal") >= 7,
  "recipe-collector": (c) => c.craftedDistinct >= 75,
  "open-road": (c) => c.unlockedCount >= 2,
  "welcoming-committee": (c) => c.totalReturned >= 50,
  "full-house": (c) => c.totalReturned >= 100,
  "field-notes": (c) => (c.counts.animalsObserved || 0) >= 100,
  "steady-hand": (c) => c.unlockedCount >= 3 && c.unlockedHealthy(50),
  "three-restored": (c) => c.biomesAtHealth(80) >= 3,
  trailblazer: (c) => c.unlockedCount >= 6,
  "caretaker-of-the-whole": (c) => c.totalReturned >= 150
};
async function earnedAchievementIds(playerId) {
  const rows = await byPlayer(db().PlayerAchievement, playerId);
  return new Set(rows.map((r) => r.achievementId));
}
async function achievementMetrics(playerId) {
  const d = await defs();
  const rows = await byPlayer(db().PlayerAchievement, playerId);
  const total = d.achievements.length || 1;
  const earnedById = new Map(rows.map((r) => [r.achievementId, r]));
  const points = d.achievements.reduce((sum, a) => sum + (earnedById.has(a.id) ? a.points || 0 : 0), 0);
  const byCategory = {};
  for (const a of d.achievements) if (earnedById.has(a.id)) byCategory[a.category] = (byCategory[a.category] || 0) + 1;
  const recent = [...rows].sort((a, b) => (b.earnedAt || 0) - (a.earnedAt || 0)).slice(0, 5).map((r) => ({ id: r.achievementId, name: d.achievement.get(r.achievementId)?.name || r.achievementId, earnedAt: r.earnedAt }));
  return {
    earned: rows.length,
    total: d.achievements.length,
    points,
    completion: round1(rows.length / total),
    byCategory,
    recent
  };
}
async function awardAchievements(playerId, opts = {}) {
  try {
    const t2 = db();
    const d = await defs();
    const player = await t2.Player.get(playerId);
    if (!player) return [];
    const earned = await earnedAchievementIds(playerId);
    const wid = worldOf(player);
    let [biomeStates, discoveries, terrain] = await Promise.all([
      byWorld(t2.BiomeState, wid),
      byWorld(t2.Discovery, wid),
      byWorld(t2.TerrainTile, wid)
    ]);
    for (const ad of opts.addDiscoveries || []) {
      if (ad?.animalId && !discoveries.some((x) => x.animalId === ad.animalId)) discoveries.push(ad);
    }
    for (const bs of opts.freshBiomeStates || []) {
      if (!bs?.biomeId) continue;
      biomeStates = biomeStates.filter((b) => b.biomeId !== bs.biomeId);
      biomeStates.push(bs);
    }
    const stateByBiome = new Map(biomeStates.map((b) => [b.biomeId, b]));
    const discById = new Map(discoveries.map((x) => [x.animalId, x]));
    const waterCache = /* @__PURE__ */ new Map();
    const unlockedSet = new Set(player.unlockedBiomes || []);
    const ctx = {
      counts: player.metrics?.counts || {},
      health: (b) => stateByBiome.get(b)?.health || 0,
      returned: (b) => stateByBiome.get(b)?.returnedCount || 0,
      disc: (animalId) => discById.get(animalId),
      totalReturned: discoveries.length,
      kindReturned: (b, kind) => discoveries.filter((x) => {
        const a = d.animal.get(x.animalId);
        return a && a.biome === b && a.kind === kind;
      }).length,
      tool: (id) => player.tools?.[id] || 1,
      unlockedCount: (player.unlockedBiomes || []).length,
      craftedDistinct: Object.keys(player.craftedEver || {}).length,
      tutorialStep: player.tutorialStep || 0,
      water: (b) => {
        if (!waterCache.has(b)) waterCache.set(b, analyzeWater(terrain.filter((tt) => tt.area === b)));
        return waterCache.get(b);
      },
      biomesAtHealth: (h) => biomeStates.filter((b) => (b.health || 0) >= h).length,
      unlockedHealthy: (h) => biomeStates.filter((b) => unlockedSet.has(b.biomeId)).every((b) => (b.health || 0) >= h)
    };
    const now = Date.now();
    const newly = [];
    for (const def of d.achievements) {
      if (earned.has(def.id)) continue;
      const trigger = ACHIEVEMENT_TRIGGERS[def.id];
      if (!trigger || !trigger(ctx)) continue;
      await t2.PlayerAchievement.put({
        id: `${playerId}:${def.id}`,
        playerId,
        achievementId: def.id,
        biome: def.biome,
        earnedAt: now
      });
      newly.push(def);
    }
    return newly;
  } catch {
    return [];
  }
}
async function awardWorldAchievements(wid, actorId, opts = {}) {
  const newlyForActor = await awardAchievements(actorId, opts);
  try {
    const t2 = db();
    const world = await t2.World.get(wid);
    if (world && !world.solo) {
      for (const m of await byWorld(t2.WorldMember, wid)) {
        if (m.playerId === actorId) continue;
        await awardAchievements(m.playerId, opts);
      }
    }
  } catch {
  }
  return newlyForActor;
}
var PublicEndpoint = class extends Resource {
  allowRead() {
    return true;
  }
  allowCreate() {
    return true;
  }
  allowUpdate() {
    return true;
  }
  allowDelete() {
    return false;
  }
};
var Version = class extends PublicEndpoint {
  async get() {
    return { build: buildStamp };
  }
};
var GameData = class extends PublicEndpoint {
  async get() {
    const d = await defs();
    return {
      biomes: d.biomes,
      animals: d.animals,
      resources: d.resources,
      recipes: d.recipes,
      habitatObjects: d.objects.map((o) => ({ ...o, rotatable: isRotatable(o) })),
      tools: d.tools,
      achievements: d.achievements,
      homeStyles: HOME_STYLES,
      homeTracks: HOME_TRACKS,
      nodeRegenSeconds: NODE_REGEN_SECONDS,
      appearanceOptions: {
        skins: SKIN_TONES,
        hair: HAIR_COLORS,
        outfits: OUTFIT_COLORS,
        hats: HAT_STYLES,
        hatColors: HAT_COLORS,
        hairstyles: HAIRSTYLES,
        beards: BEARD_STYLES,
        bodies: BODY_TYPES
      }
    };
  }
};
var CreatePlayer = class extends PublicEndpoint {
  async post(data) {
    const { name, passcode, appearance, tzOffsetMinutes } = await bodyOf(data);
    const cleanName = String(name || "").trim();
    if (cleanName.length < 2 || cleanName.length > 24) throw new GameError(t("server.err.nameLength"));
    const code = String(passcode || "");
    if (code.length < 4 || code.length > 32) throw new GameError(t("server.err.passcodeLength"));
    const playerId = slugId(cleanName);
    if (!playerId) throw new GameError(t("server.err.nameNeedsAlnum"));
    const existing = await safeGet(db().Player, playerId);
    if (existing) throw new GameError(t("server.err.saveExists"), 409);
    const created = await createPlayerRecords(playerId, cleanName, code, sanitizeAppearance(appearance), sanitizeTzOffset(tzOffsetMinutes));
    let worlds = [];
    try {
      await ensureSoloWorld(created.player, { freshGrid: true });
      worlds = await listMemberships(playerId);
    } catch (e) {
      console.error("world setup skipped (CreatePlayer):", e);
    }
    return { ok: true, playerId, worldId: playerId, worlds, state: await freshSnapshot(created) };
  }
};
var DeletePlayer = class extends PublicEndpoint {
  async post(data) {
    const { name, passcode } = await bodyOf(data);
    const playerId = slugId(String(name || ""));
    const player = playerId ? await db().Player.get(playerId) : null;
    if (!player) throw new GameError(t("server.err.noSaveWithName"), 404);
    if (!await verifyPasscode(player, passcode)) throw new GameError(t("server.err.passcodeMismatch"), 403);
    const t2 = db();
    let removed = 0;
    for (const table of [t2.Placement, t2.Chest, t2.BiomeState, t2.Discovery, t2.NodeState, t2.TerrainTile, t2.FeedEntry]) {
      for (const rec of await byWorld(table, playerId)) {
        await table.delete(rec.id);
        removed++;
      }
    }
    for (const rec of await byPlayer(t2.PlayerAchievement, playerId)) {
      await t2.PlayerAchievement.delete(rec.id);
      removed++;
    }
    for (const m of await byPlayer(t2.WorldMember, playerId)) {
      await t2.WorldMember.delete(m.id);
      removed++;
    }
    if (await t2.World.get(playerId)) {
      await t2.World.delete(playerId);
      removed++;
    }
    await t2.Player.delete(playerId);
    return { ok: true, deleted: playerId, recordsRemoved: removed + 1 };
  }
};
var ChangePasscode = class extends PublicEndpoint {
  async post(data) {
    const { playerId, currentPasscode, newPasscode } = await bodyOf(data);
    const { player } = await requirePlayer(playerId);
    if (!await verifyPasscode(player, currentPasscode)) throw new GameError(t("server.err.passcodeMismatch"), 403);
    const next = String(newPasscode || "");
    if (next.length < 4 || next.length > 32) throw new GameError(t("server.err.newPasscodeLength"));
    const { salt, hash } = hashPasscode(next);
    await db().Player.patch(playerId, { passcodeHash: hash, passcodeSalt: salt, passcode: null });
    return { ok: true };
  }
};
var LoginPlayer = class extends PublicEndpoint {
  async post(data) {
    const { name, passcode, tzOffsetMinutes } = await bodyOf(data);
    const playerId = slugId(String(name || ""));
    const player = playerId ? await safeGet(db().Player, playerId) : null;
    if (!player) throw new GameError(t("server.err.noSaveTryNew"), 404);
    if (!await verifyPasscode(player, passcode)) throw new GameError(t("server.err.passcodeMismatch"), 403);
    const d = await defs();
    const now = Date.now();
    const prev = player.metrics || freshMetrics(player.createdAt || now);
    await db().Player.patch(playerId, {
      metrics: { ...prev, lastHeartbeatAt: 0 },
      ...tzOffsetMinutes != null ? { tzOffsetMinutes: sanitizeTzOffset(tzOffsetMinutes) } : {}
    });
    let active = player.worldId || playerId;
    let worlds = [];
    try {
      await ensureSoloWorld(player);
      active = (await db().Player.get(playerId)).worldId || playerId;
      await syncMemberUnlocks(playerId, active);
      worlds = await listMemberships(playerId);
    } catch (e) {
      console.error("world setup skipped (LoginPlayer):", e);
    }
    const areaBiome = d.biome.get(player.area);
    if (player.area === "home" || !areaBiome || !areaBiome.explorable) {
      await db().Player.patch(playerId, { area: "meadow", x: 24.5, y: 6.5 });
    }
    return { ok: true, playerId, worldId: active, worlds, state: await snapshot(playerId) };
  }
};
var GameState = class extends PublicEndpoint {
  async get() {
    const playerId = String(this.getId() || "");
    await requirePlayer(playerId);
    return snapshot(playerId);
  }
};
var MyWorlds = class extends PublicEndpoint {
  async post(data) {
    const { playerId } = await bodyOf(data);
    const { player } = await requirePlayer(playerId);
    await ensureSoloWorld(player);
    return { ok: true, activeWorldId: worldOf(player), worlds: await listMemberships(playerId) };
  }
};
var CreateWorld = class extends PublicEndpoint {
  async post(data) {
    const { playerId, name } = await bodyOf(data);
    const t2 = db();
    const { player } = await requirePlayer(playerId);
    await ensureSoloWorld(player);
    const cleanName = String(name || "").trim() || t("server.world.coopName", { name: player.name });
    if (cleanName.length > 40) throw new GameError(t("server.err.worldNameLength"));
    const worldId = `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    let joinCode = genJoinCode();
    const allWorlds = await allOf(t2.World);
    const taken = new Set(allWorlds.map((w) => w.joinCode).filter(Boolean));
    let guard = 0;
    while (taken.has(joinCode) && guard++ < 20) joinCode = genJoinCode();
    const now = Date.now();
    await t2.World.put({
      id: worldId,
      name: cleanName,
      solo: false,
      ownerId: playerId,
      joinCode,
      createdAt: now,
      maxMembers: DEFAULT_MAX_MEMBERS
    });
    await t2.WorldMember.put({
      id: `${worldId}:${playerId}`,
      worldId,
      playerId,
      role: "owner",
      joinedAt: now,
      lastSeenAt: now
    });
    const d = await defs();
    for (const b of d.biomes) {
      await t2.BiomeState.put({
        id: `${worldId}:${b.id}`,
        worldId,
        playerId,
        biomeId: b.id,
        health: BASE_HEALTH,
        balance: 0,
        returnedCount: 0,
        unlocked: b.id === "meadow"
      });
    }
    return { ok: true, world: { worldId, name: cleanName, joinCode, solo: false, role: "owner", isOwner: true, memberCount: 1, maxMembers: DEFAULT_MAX_MEMBERS }, worlds: await listMemberships(playerId) };
  }
};
async function worldByCode(t2, joinCode) {
  const code = String(joinCode || "").trim().toUpperCase();
  if (!code) return null;
  return (await allOf(t2.World)).find((w) => !w.solo && w.joinCode === code) || null;
}
var JoinWorld = class extends PublicEndpoint {
  async post(data) {
    const { playerId, joinCode, token } = await bodyOf(data);
    const t2 = db();
    const { player } = await requirePlayer(playerId);
    await ensureSoloWorld(player);
    const world = await worldByCode(t2, joinCode);
    if (!world) throw new GameError(t("server.err.noWorldWithCode"), 404);
    const memberId = `${world.id}:${playerId}`;
    const already = await t2.WorldMember.get(memberId);
    if (!already) {
      const tok = String(token || "").trim();
      const req = tok ? await t2.JoinRequest.get(`${world.id}:${tok}`) : null;
      if (!req || req.status !== "approved") {
        throw new GameError(t("server.err.hostNotApproved"), 403);
      }
      const max = world.maxMembers || DEFAULT_MAX_MEMBERS;
      const members = await byWorld(t2.WorldMember, world.id);
      if (members.length >= max) {
        throw new GameError(t("server.err.worldFullJoined", { max }), 409);
      }
      await t2.WorldMember.put({
        id: memberId,
        worldId: world.id,
        playerId,
        role: "member",
        joinedAt: Date.now(),
        lastSeenAt: Date.now()
      });
      await t2.JoinRequest.delete(`${world.id}:${tok}`);
      const at = Date.now();
      await t2.FeedEntry.put({
        id: `f_${world.id}_${at}_${Math.random().toString(36).slice(2, 7)}`,
        worldId: world.id,
        playerId,
        at,
        icon: "user",
        text: t("server.feed.joinedWorld", { name: player.name })
      });
    }
    await t2.Player.patch(playerId, { worldId: world.id });
    await syncMemberUnlocks(playerId, world.id);
    let worldsList = await listMemberships(playerId);
    if (!worldsList.some((w) => w.worldId === world.id)) {
      const members = await byWorld(t2.WorldMember, world.id);
      const here = members.some((m) => m.playerId === playerId) ? members.length : members.length + 1;
      worldsList = [...worldsList, {
        worldId: world.id,
        name: world.name,
        solo: false,
        role: world.ownerId === playerId ? "owner" : "member",
        joinCode: world.joinCode,
        memberCount: here,
        maxMembers: world.maxMembers || DEFAULT_MAX_MEMBERS,
        isOwner: world.ownerId === playerId
      }];
    }
    return { ok: true, worldId: world.id, worlds: worldsList, state: await snapshot(playerId, { worldId: world.id }) };
  }
};
var CheckWorldCode = class extends PublicEndpoint {
  async post(data) {
    const { joinCode } = await bodyOf(data);
    const t2 = db();
    const world = await worldByCode(t2, joinCode);
    if (!world) return { ok: true, exists: false };
    const memberCount = (await byWorld(t2.WorldMember, world.id)).length;
    const owner = await t2.Player.get(world.ownerId);
    const max = world.maxMembers || DEFAULT_MAX_MEMBERS;
    return {
      ok: true,
      exists: true,
      world: { worldId: world.id, name: world.name, hostName: owner?.name || t("server.fallback.host"), memberCount, maxMembers: max, full: memberCount >= max }
    };
  }
};
var RequestJoin = class extends PublicEndpoint {
  async post(data) {
    const { joinCode, token, name } = await bodyOf(data);
    const t2 = db();
    const world = await worldByCode(t2, joinCode);
    if (!world) throw new GameError(t("server.err.noWorldWithCode"), 404);
    const tok = String(token || "").trim();
    if (!tok) throw new GameError(t("server.err.missingToken"));
    const max = world.maxMembers || DEFAULT_MAX_MEMBERS;
    const memberCount = (await byWorld(t2.WorldMember, world.id)).length;
    if (memberCount >= max) throw new GameError(t("server.err.worldFullClosed", { max }), 409);
    const cleanName = String(name || "").trim().slice(0, 24) || t("server.fallback.newCaretaker");
    await t2.JoinRequest.put({ id: `${world.id}:${tok}`, worldId: world.id, token: tok, name: cleanName, status: "pending", createdAt: Date.now() });
    const owner = await t2.Player.get(world.ownerId);
    return { ok: true, worldId: world.id, world: { name: world.name, hostName: owner?.name || t("server.fallback.host") } };
  }
};
var JoinRequestStatus = class extends PublicEndpoint {
  async post(data) {
    const { worldId, token } = await bodyOf(data);
    const t2 = db();
    const req = await t2.JoinRequest.get(`${worldId}:${String(token || "").trim()}`);
    return { ok: true, status: req?.status || "none" };
  }
};
var PendingJoinRequests = class extends PublicEndpoint {
  async post(data) {
    const { playerId } = await bodyOf(data);
    const { player } = await requirePlayer(playerId);
    const t2 = db();
    const wid = worldOf(player);
    const world = await t2.World.get(wid);
    if (!world || world.solo || world.ownerId !== playerId) return { ok: true, requests: [] };
    const reqs = (await byWorld(t2.JoinRequest, wid)).filter((r) => r.status === "pending");
    reqs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    return { ok: true, requests: reqs.map((r) => ({ token: r.token, name: r.name, createdAt: r.createdAt })) };
  }
};
var ResolveJoin = class extends PublicEndpoint {
  async post(data) {
    const { playerId, worldId, token, approve } = await bodyOf(data);
    await requirePlayer(playerId);
    const t2 = db();
    const world = await t2.World.get(worldId);
    if (!world || world.solo) throw new GameError(t("server.err.noCoopWorld"), 404);
    if (world.ownerId !== playerId) throw new GameError(t("server.err.onlyHostApproves"), 403);
    const id = `${worldId}:${String(token || "").trim()}`;
    const req = await t2.JoinRequest.get(id);
    if (!req) throw new GameError(t("server.err.requestNotPending"), 404);
    await t2.JoinRequest.patch(id, { status: approve ? "approved" : "denied", resolvedAt: Date.now() });
    return { ok: true };
  }
};
var WorldRoster = class extends PublicEndpoint {
  async post(data) {
    const { playerId } = await bodyOf(data);
    const { player } = await requirePlayer(playerId);
    const t2 = db();
    const wid = worldOf(player);
    const world = await t2.World.get(wid);
    const max = world?.maxMembers || DEFAULT_MAX_MEMBERS;
    if (!world || world.solo) return { ok: true, roster: [], closed: false, maxMembers: max, joinCode: null };
    const members = await byWorld(t2.WorldMember, wid);
    const roster = [];
    for (const m of members) {
      const p = await safeGet(t2.Player, m.playerId);
      roster.push({
        playerId: m.playerId,
        name: p?.name || t("server.fallback.caretaker"),
        isOwner: m.role === "owner" || world.ownerId === m.playerId,
        joinedAt: m.joinedAt || 0
      });
    }
    roster.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
    return { ok: true, roster, closed: roster.length >= max, maxMembers: max, joinCode: world.joinCode };
  }
};
var SwitchWorld = class extends PublicEndpoint {
  async post(data) {
    const { playerId, worldId } = await bodyOf(data);
    const t2 = db();
    const { player } = await requirePlayer(playerId);
    await ensureSoloWorld(player);
    const target = String(worldId || "");
    if (!await t2.WorldMember.get(`${target}:${playerId}`)) {
      throw new GameError(t("server.err.notWorldMember"), 403);
    }
    await t2.Player.patch(playerId, { worldId: target });
    await t2.WorldMember.patch(`${target}:${playerId}`, { lastSeenAt: Date.now() });
    await syncMemberUnlocks(playerId, target);
    return { ok: true, worldId: target, worlds: await listMemberships(playerId), state: await snapshot(playerId, { worldId: target }) };
  }
};
var LeaveWorld = class extends PublicEndpoint {
  async post(data) {
    const { playerId, worldId } = await bodyOf(data);
    const t2 = db();
    const { player } = await requirePlayer(playerId);
    const target = String(worldId || "");
    if (target === playerId) throw new GameError(t("server.err.cannotLeaveSolo"));
    const memberId = `${target}:${playerId}`;
    if (!await t2.WorldMember.get(memberId)) throw new GameError(t("server.err.notInWorld"), 404);
    await t2.WorldMember.delete(memberId);
    if (player.worldId === target) {
      await t2.Player.patch(playerId, { worldId: playerId, area: "meadow", x: 24.5, y: 6.5 });
      await syncMemberUnlocks(playerId, playerId);
    }
    const active = player.worldId === target ? playerId : player.worldId || playerId;
    return { ok: true, worldId: active, worlds: await listMemberships(playerId), state: await snapshot(playerId, { worldId: active }) };
  }
};
var PRESENCE_WINDOW_MS = 15e3;
var Presence = class extends PublicEndpoint {
  async post(data) {
    const { playerId, x, y, area } = await bodyOf(data);
    const t2 = db();
    const { player } = await requirePlayer(playerId);
    const wid = worldOf(player);
    const now = Date.now();
    const px = Number.isFinite(Number(x)) ? Number(x) : player.x;
    const py = Number.isFinite(Number(y)) ? Number(y) : player.y;
    const parea = typeof area === "string" ? area : player.area;
    const world = await t2.World.get(wid);
    if (world?.solo) return { ok: true, worldId: wid, peers: [] };
    const rec = await t2.WorldPresence.get(wid) || { id: wid, players: {} };
    const players = { ...rec.players || {} };
    players[playerId] = { playerId, name: player.name, appearance: player.appearance, area: parea, x: px, y: py, t: now };
    for (const pid of Object.keys(players)) {
      if (now - (players[pid]?.t || 0) > PRESENCE_WINDOW_MS) delete players[pid];
    }
    await t2.WorldPresence.put({ id: wid, players, updatedAt: now });
    const peers = Object.values(players).filter((p) => p.playerId !== playerId);
    return { ok: true, worldId: wid, peers };
  }
};
var CollectResource = class extends PublicEndpoint {
  async post(data) {
    const { playerId, biomeId, nodeId, resourceId } = await bodyOf(data);
    const t2 = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const wid = worldOf(player);
    const biome = d.biome.get(biomeId);
    if (!biome) throw new GameError(t("server.err.unknownBiome", { biome: biomeId }));
    if (!(player.unlockedBiomes || []).includes(biomeId)) throw new GameError(t("server.err.biomeLocked", { biome: biome.name }), 403);
    const resDef = d.resource.get(resourceId);
    if (!resDef) throw new GameError(t("server.err.unknownResource", { resource: resourceId }));
    if (isWeatherGatheredResource(resourceId)) {
      const active = weatherTypeAt(wid, biomeId, weatherTimeFromPlay(player));
      if (gatherResourceIdFor(biomeId, active) !== resourceId) {
        throw new GameError(t("server.err.weatherOnly", { resource: resDef.name }), 409);
      }
    } else if (!(biome.resources || []).includes(resourceId)) {
      throw new GameError(t("server.err.resourceNotInBiome", { resource: resourceId, biome: biome.name }));
    }
    if (!nodeId || typeof nodeId !== "string") throw new GameError(t("server.err.nodeIdRequired"));
    const nodeKey = `${wid}:${biomeId}:${nodeId}`;
    const nodeState = await t2.NodeState.get(nodeKey);
    const now = Date.now();
    if (nodeState && now - nodeState.harvestedAt < NODE_REGEN_SECONDS * 1e3) {
      throw new GameError(t("server.err.regrowing"), 409);
    }
    const capacity = inventoryCapacity(player);
    const carried = sumValues(player.inventory);
    if (carried >= capacity) throw new GameError(t("server.err.basketFullStore"), 409);
    const toolTier = player.tools?.[resDef.tool] || 1;
    const amount = Math.min(Math.max(1, toolTier), capacity - carried);
    const perk = homePerk(player);
    const perkBonus = perk?.id === "forage" && capacity - carried - amount > 0 && Math.random() < perk.strength ? 1 : 0;
    const total = amount + perkBonus;
    const inventory = { ...player.inventory || {} };
    inventory[resourceId] = (inventory[resourceId] || 0) + total;
    await t2.Player.patch(playerId, { inventory });
    await t2.NodeState.put({ id: nodeKey, worldId: wid, playerId, harvestedAt: now });
    await bumpMetrics(player, { resourcesCollected: total }, { [`res:${resourceId}`]: total });
    await awardAchievements(playerId);
    return { ok: true, gained: { [resourceId]: total }, perkBonus: perkBonus || void 0, inventory, nodeId, harvestedAt: now };
  }
};
var ChestTransfer = class extends PublicEndpoint {
  async post(data) {
    const { playerId, chestId, resourceId, qty, direction } = await bodyOf(data);
    const t2 = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const wid = worldOf(player);
    const amount = posInt(qty, "qty");
    const chest = await getOwnedChest(t2, d, chestId, wid);
    if (!chest) throw new GameError(t("server.err.chestNotFound"), 404);
    const inventory = { ...player.inventory || {} };
    const contents = { ...chest.contents || {} };
    if (direction === "deposit") {
      if ((inventory[resourceId] || 0) < amount) throw new GameError(t("server.err.notEnoughInBasket", { resource: resourceId }));
      if (sumValues(contents) + amount > chest.capacity) throw new GameError(t("server.err.chestFull"), 409);
      inventory[resourceId] -= amount;
      if (inventory[resourceId] <= 0) delete inventory[resourceId];
      contents[resourceId] = (contents[resourceId] || 0) + amount;
    } else if (direction === "withdraw") {
      if ((contents[resourceId] || 0) < amount) throw new GameError(t("server.err.notEnoughInChest", { resource: resourceId }));
      if (sumValues(inventory) + amount > inventoryCapacity(player)) throw new GameError(t("server.err.basketFull"), 409);
      contents[resourceId] -= amount;
      if (contents[resourceId] <= 0) delete contents[resourceId];
      inventory[resourceId] = (inventory[resourceId] || 0) + amount;
    } else {
      throw new GameError(t("server.err.badDirection"));
    }
    await t2.Player.patch(playerId, { inventory });
    await t2.Chest.patch(chestId, { contents });
    await bumpMetrics(player, direction === "deposit" ? { chestDeposits: 1 } : { chestWithdrawals: 1 });
    return { ok: true, inventory, chest: { ...chest, contents } };
  }
};
var DiscardItem = class extends PublicEndpoint {
  async post(data) {
    const { playerId, kind, id, qty } = await bodyOf(data);
    const t2 = db();
    const { player } = await requirePlayer(playerId);
    const amount = posInt(qty, "qty");
    if (!id || typeof id !== "string") throw new GameError(t("server.err.idRequired"));
    if (kind === "crafted") {
      const craftedItems = { ...player.craftedItems || {} };
      if ((craftedItems[id] || 0) < amount) throw new GameError(t("server.err.discardTooMany"));
      craftedItems[id] -= amount;
      if (craftedItems[id] <= 0) delete craftedItems[id];
      await t2.Player.patch(playerId, { craftedItems });
      await bumpMetrics(player, { itemsDiscarded: amount });
      return { ok: true, craftedItems };
    }
    const inventory = { ...player.inventory || {} };
    if ((inventory[id] || 0) < amount) throw new GameError(t("server.err.discardTooMany"));
    inventory[id] -= amount;
    if (inventory[id] <= 0) delete inventory[id];
    await t2.Player.patch(playerId, { inventory });
    await bumpMetrics(player, { itemsDiscarded: amount });
    return { ok: true, inventory };
  }
};
var CraftItem = class extends PublicEndpoint {
  async post(data) {
    const { playerId, recipeId } = await bodyOf(data);
    const t2 = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const wid = worldOf(player);
    const recipe = d.recipe.get(recipeId);
    if (!recipe) throw new GameError(t("server.err.unknownRecipe", { recipe: recipeId }));
    const outObj = d.object.get(recipe.output.itemId);
    if (outObj?.plantable) {
      throw new GameError(t("server.err.plantedNotCrafted", { name: recipe.name }), 400);
    }
    if (!player.devUnlockAll && outObj?.homeMin && (homeOf(player).space || 1) < outObj.homeMin) {
      throw new GameError(t("server.err.needsProperHouse", { name: recipe.name }), 403);
    }
    const devUnlock = !!player.devUnlockAll;
    if (!devUnlock && recipe.unlockBiome && !(player.unlockedBiomes || []).includes(recipe.unlockBiome)) {
      throw new GameError(t("server.err.recipeBiomeLocked"), 403);
    }
    if (!devUnlock && recipe.unlock && recipe.unlockBiome) {
      const ctx = await recipeUnlockContext(wid, recipe.unlockBiome, player, d);
      if (!recipeUnlockMet(recipe, ctx)) {
        throw new GameError(t("server.err.recipeLocked", { label: recipe.unlock.label }), 403);
      }
    }
    if (recipe.requiresTool && (player.tools?.[recipe.requiresTool.id] || 1) < recipe.requiresTool.tier) {
      const tool = d.tool.get(recipe.requiresTool.id);
      throw new GameError(t("server.err.requiresUpgradedTool", { tool: tool?.name || recipe.requiresTool.id }), 403);
    }
    if (recipe.once && (player.craftedEver?.[recipe.output.itemId] || 0) > 0) {
      throw new GameError(t("server.err.craftOnce", { name: recipe.name }), 409);
    }
    const { usedFrom, inventory } = await consumeMaterials(player, recipe.materials || {}, wid);
    const perk = homePerk(player);
    let refund;
    if (perk?.id === "thrift" && Object.keys(recipe.materials || {}).length && Math.random() < perk.strength) {
      let room = inventoryCapacity(player) - sumValues(inventory);
      for (const [rid, q] of Object.entries(recipe.materials || {})) {
        const back = Math.min(Math.max(1, Math.floor(q / 2)), Math.max(0, room));
        if (back > 0) {
          refund = refund || {};
          refund[rid] = back;
          inventory[rid] = (inventory[rid] || 0) + back;
          room -= back;
        }
      }
    }
    const craftedItems = { ...player.craftedItems || {} };
    const craftedEver = { ...player.craftedEver || {} };
    craftedItems[recipe.output.itemId] = (craftedItems[recipe.output.itemId] || 0) + (recipe.output.qty || 1);
    craftedEver[recipe.output.itemId] = (craftedEver[recipe.output.itemId] || 0) + (recipe.output.qty || 1);
    await t2.Player.patch(playerId, refund ? { craftedItems, craftedEver, inventory } : { craftedItems, craftedEver });
    const unlockedBiomes = await checkUnlocks(wid, playerId, { player: { ...player, craftedItems, craftedEver } });
    const chests = await byWorld(t2.Chest, wid);
    await bumpMetrics(player, { itemsCrafted: 1 }, { craft: 1 });
    await awardAchievements(playerId);
    return { ok: true, crafted: recipe.output, craftedItems, inventory, chests, usedFrom, refund, unlockedBiomes };
  }
};
function normRot(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return (Math.round(n / 90) * 90 % 360 + 360) % 360;
}
var ROTATABLE_IDS = /* @__PURE__ */ new Set([
  "wooden-fence",
  "dry-stone-wall",
  "wooden-bench",
  "hammock",
  "picnic-blanket",
  "garden-arch",
  "trail-signpost",
  "flower-cart",
  "home-bed",
  "home-sleeping-bag",
  "home-bookshelf",
  "home-armchair",
  "home-fireplace",
  "home-table",
  "home-dresser",
  "home-driftwoodshelf",
  "home-mushroomshelf",
  "home-reedmat",
  "home-peltrug",
  "home-rug",
  "home-cushions",
  "home-stool",
  "home-aquarium",
  "home-telescope"
]);
function isRotatable(def) {
  if (!def) return false;
  if (def.rotatable === true) return true;
  if (def.bridge) return true;
  if (/-path$/.test(def.id)) return true;
  return ROTATABLE_IDS.has(def.id);
}
var PlaceObject = class extends PublicEndpoint {
  async post(data) {
    const { playerId, objectId, area, x, y, rotation } = await bodyOf(data);
    const t2 = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const wid = worldOf(player);
    const def = d.object.get(objectId);
    if (!def) throw new GameError(t("server.err.unknownObject", { object: objectId }));
    if (def.placement === "none") throw new GameError(t("server.err.kitNotPlaceable", { name: def.name }));
    if ((player.craftedItems?.[objectId] || 0) <= 0) throw new GameError(t("server.err.noneCrafted", { name: def.name }));
    const tx = Math.round(Number(x));
    const ty = Math.round(Number(y));
    const grid = areaGrid(d, area);
    if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 1 || ty < 1 || tx > grid.cols - 2 || ty > grid.rows - 2) {
      throw new GameError(t("server.err.outOfReach"));
    }
    if (area === "home") {
      if (def.placement === "outdoor") throw new GameError(t("server.err.outdoorOnly", { name: def.name }));
      if (def.homeMin && (homeOf(player).space || 1) < def.homeMin) {
        throw new GameError(t("server.err.needsBiggerHome", { name: def.name }), 403);
      }
      const r = homeRoom(player);
      if (tx < r.x0 || tx > r.x1 || ty < r.y0 || ty > r.y1) throw new GameError(t("server.err.placeOnFloor"));
    } else {
      const biome = d.biome.get(area);
      if (!biome) throw new GameError(t("server.err.unknownArea", { area }));
      if (!(player.unlockedBiomes || []).includes(area)) throw new GameError(t("server.err.biomeLocked", { biome: biome.name }), 403);
      if (def.placement === "indoor") throw new GameError(t("server.err.indoorOnly", { name: def.name }));
      if (!(def.biomes || []).includes(area)) throw new GameError(t("server.err.wrongHabitat", { name: def.name, biome: biome.name }));
      if (biome.oceanCols && tx >= grid.cols - biome.oceanCols) throw new GameError(t("server.err.openOcean"), 409);
    }
    if (def.requiresTool && (player.tools?.[def.requiresTool.id] || 1) < def.requiresTool.tier) {
      throw new GameError(t("server.err.placeRequiresTool", { name: def.name, tool: d.tool.get(def.requiresTool.id)?.name || def.requiresTool.id }), 403);
    }
    const placements = await byWorld(t2.Placement, wid);
    if (placements.some((p) => p.area === area && p.x === tx && p.y === ty)) {
      throw new GameError(t("server.err.spotTaken"), 409);
    }
    const tileHere = area === "home" ? null : await findTerrainAt(t2.TerrainTile, wid, area, tx, ty);
    if (tileHere) {
      if (tileHere.type === "water") {
        if (!def.bridge) throw new GameError(t("server.err.openWaterBridge"), 409);
      } else {
        throw new GameError(t("server.err.bedForPlanting"), 409);
      }
    } else if (def.bridge && area !== "home") {
      throw new GameError(t("server.err.bridgeNeedsWater"), 409);
    }
    const craftedItems = { ...player.craftedItems || {} };
    craftedItems[objectId] -= 1;
    if (craftedItems[objectId] <= 0) delete craftedItems[objectId];
    await t2.Player.patch(playerId, { craftedItems });
    const placementId = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const placement = { id: placementId, worldId: wid, playerId, objectId, area, x: tx, y: ty, placedAt: Date.now(), rotation: isRotatable(def) ? normRot(rotation) : 0 };
    await t2.Placement.put(placement);
    if (def.isChest) {
      await t2.Chest.put({
        id: placementId,
        worldId: wid,
        playerId,
        area,
        x: tx,
        y: ty,
        size: objectId,
        capacity: def.chestCapacity || 60,
        contents: {}
      });
    }
    if (area === "home") {
      await bumpMetrics(player, { objectsPlaced: 1 }, { place: 1 });
      await awardAchievements(playerId);
      return { ok: true, placement, craftedItems };
    }
    const recalc = await recalcBiome(wid, playerId, area, {
      addPlacements: [placement],
      player: { ...player, craftedItems }
    });
    await bumpMetrics(player, { objectsPlaced: 1, animalsReturned: recalc.newAnimals?.length || 0 }, { place: 1 });
    await awardWorldAchievements(wid, playerId, { addDiscoveries: recalc.newAnimals, freshBiomeStates: [recalc.biomeState] });
    return { ok: true, placement, craftedItems, ...recalc };
  }
};
var Plant = class extends PublicEndpoint {
  async post(data) {
    const { playerId, area, x, y, plantId } = await bodyOf(data);
    const t2 = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const wid = worldOf(player);
    const biome = d.biome.get(area);
    if (!biome) throw new GameError(t("server.err.unknownArea", { area }));
    if (!(player.unlockedBiomes || []).includes(area)) throw new GameError(t("server.err.biomeLocked", { biome: biome.name }), 403);
    const def = d.object.get(plantId);
    if (!def || !def.plantable) throw new GameError(t("server.err.notPlantable"));
    if (!(def.biomes || []).includes(area)) throw new GameError(t("server.err.wouldNotTakeRoot", { name: def.name, biome: biome.name }));
    const tx = Math.round(Number(x));
    const ty = Math.round(Number(y));
    const bed = await findTerrainAt(t2.TerrainTile, wid, area, tx, ty);
    if (!bed || bed.type !== "watered") {
      throw new GameError(t("server.err.plantIntoWatered"));
    }
    const { usedFrom, inventory } = await consumeMaterials(player, def.plantCost || {}, wid);
    await t2.TerrainTile.delete(bed.id);
    const perk = homePerk(player);
    const headStart = perk?.id === "growth" ? perk.strength : 0;
    const now = Date.now();
    const placementId = `pl_${now}_${Math.random().toString(36).slice(2, 8)}`;
    const placement = {
      id: placementId,
      worldId: wid,
      playerId,
      objectId: plantId,
      area,
      x: tx,
      y: ty,
      placedAt: now - Math.round(matureMs(def) * headStart),
      plantedAt: now - Math.round((def.growSeconds || 0) * 1e3 * headStart)
    };
    await t2.Placement.put(placement);
    const recalc = await recalcBiome(wid, playerId, area, {
      addPlacements: [placement],
      removeTerrainIds: [bed.id],
      player: { ...player, inventory }
    });
    await bumpMetrics(player, { plantsPlanted: 1, animalsReturned: recalc.newAnimals?.length || 0 }, { plant: 1 });
    await awardWorldAchievements(wid, playerId, { addDiscoveries: recalc.newAnimals, freshBiomeStates: [recalc.biomeState] });
    return { ok: true, placement, inventory, usedFrom, perkGrowth: headStart || void 0, ...recalc };
  }
};
function harvestReadyAt(def, placement) {
  const y = def?.yield;
  if (!y || !def?.plantable || !placement?.plantedAt) return null;
  const growMs = (def.growSeconds || 0) * 1e3;
  const regrowMs = (y.regrowSeconds || 60) * 1e3;
  return placement.lastHarvestAt ? placement.lastHarvestAt + regrowMs : placement.plantedAt + growMs;
}
var HarvestPlacement = class extends PublicEndpoint {
  async post(data) {
    const { playerId, placementId } = await bodyOf(data);
    const t2 = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const wid = worldOf(player);
    const now = Date.now();
    const placement = (await byWorld(t2.Placement, wid)).find((p) => p.id === placementId);
    if (!placement) throw new GameError(t("server.err.placementNotFound"), 404);
    const def = d.object.get(placement.objectId);
    const y = def?.yield;
    if (!y) throw new GameError(t("server.err.notHarvestable"));
    const readyAt = harvestReadyAt(def, placement);
    if (readyAt == null || now < readyAt) throw new GameError(t("server.err.notReadyYet"));
    const capacity = inventoryCapacity(player);
    const inventory = { ...player.inventory || {} };
    const room = Math.max(0, capacity - sumValues(inventory));
    const take = Math.min(y.qty || 1, room);
    if (take <= 0) throw new GameError(t("server.err.basketFullHarvest"), 409);
    inventory[y.resourceId] = (inventory[y.resourceId] || 0) + take;
    await t2.Player.patch(playerId, { inventory });
    await t2.Placement.patch(placementId, { lastHarvestAt: now });
    await bumpMetrics(player, { resourcesCollected: take });
    return { ok: true, placementId, gained: { [y.resourceId]: take }, inventory, placement: { ...placement, lastHarvestAt: now } };
  }
};
var UpdateAppearance = class extends PublicEndpoint {
  async post(data) {
    const { playerId, appearance } = await bodyOf(data);
    const { player } = await requirePlayer(playerId);
    const clean = sanitizeAppearance(appearance);
    await db().Player.patch(playerId, { appearance: clean });
    await bumpMetrics(player, { appearanceChanges: 1 });
    return { ok: true, appearance: clean };
  }
};
var MoveObject = class extends PublicEndpoint {
  async post(data) {
    const { playerId, placementId, x, y, rotation } = await bodyOf(data);
    const t2 = db();
    const { player } = await requirePlayer(playerId);
    const wid = worldOf(player);
    const placements = await byWorld(t2.Placement, wid);
    const placement = placements.find((p) => p.id === placementId);
    if (!placement) throw new GameError(t("server.err.placementNotFound"), 404);
    if (placement.objectId === "workbench") throw new GameError(t("server.err.workbenchStays"));
    const dGrid = await defs();
    const grid = areaGrid(dGrid, placement.area);
    const tx = Math.round(Number(x));
    const ty = Math.round(Number(y));
    if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 1 || ty < 1 || tx > grid.cols - 2 || ty > grid.rows - 2) {
      throw new GameError(t("server.err.outOfReach"));
    }
    if (placements.some((p) => p.id !== placementId && p.area === placement.area && p.x === tx && p.y === ty)) {
      throw new GameError(t("server.err.spotTaken"), 409);
    }
    const d = await defs();
    const movingDef = d.object.get(placement.objectId);
    const tileHere = await findTerrainAt(t2.TerrainTile, wid, placement.area, tx, ty);
    if (tileHere) {
      if (tileHere.type === "water") {
        if (!movingDef?.bridge) throw new GameError(t("server.err.openWaterBridgeOnly"), 409);
      } else {
        throw new GameError(t("server.err.bedForPlantingShort"), 409);
      }
    } else if (movingDef?.bridge) {
      throw new GameError(t("server.err.bridgesOverWater"), 409);
    }
    const patch = { x: tx, y: ty };
    if (rotation !== void 0 && isRotatable(movingDef)) patch.rotation = normRot(rotation);
    await t2.Placement.patch(placementId, patch);
    const chest = await getOwnedChest(t2, d, placementId, wid);
    if (chest) await t2.Chest.patch(placementId, { x: tx, y: ty });
    await bumpMetrics(player, { objectsMoved: 1 });
    return { ok: true, placement: { ...placement, ...patch } };
  }
};
var RemoveObject = class extends PublicEndpoint {
  async post(data) {
    const { playerId, placementId } = await bodyOf(data);
    const t2 = db();
    const { player } = await requirePlayer(playerId);
    const wid = worldOf(player);
    const placement = await findInWorld(t2.Placement, wid, placementId);
    if (!placement) throw new GameError(t("server.err.placementNotFound"), 404);
    if (placement.objectId === "workbench") {
      throw new GameError(t("server.err.workbenchStays"));
    }
    const chest = await findInWorld(t2.Chest, wid, placementId);
    if (chest && sumValues(chest.contents) > 0) {
      throw new GameError(t("server.err.emptyChestFirst"), 409);
    }
    const d = await defs();
    const def = d.object.get(placement.objectId);
    let refunded = null;
    const craftedItems = { ...player.craftedItems || {} };
    const inventory = { ...player.inventory || {} };
    const chestUpdates = /* @__PURE__ */ new Map();
    if (def?.plantable && placement.plantedAt && Object.keys(def.plantCost || {}).length) {
      refunded = { ...def.plantCost };
      const capacity = inventoryCapacity(player);
      let carried = sumValues(inventory);
      const chests = (await byWorld(t2.Chest, wid)).filter((c) => c.id !== placementId);
      for (const [resId, qty] of Object.entries(refunded)) {
        let remaining = qty;
        const toBasket = Math.min(remaining, Math.max(0, capacity - carried));
        if (toBasket > 0) {
          inventory[resId] = (inventory[resId] || 0) + toBasket;
          carried += toBasket;
          remaining -= toBasket;
        }
        for (const c of chests) {
          if (remaining <= 0) break;
          const contents = chestUpdates.get(c.id) || { ...c.contents || {} };
          const room = c.capacity - sumValues(contents);
          const toChest = Math.min(room, remaining);
          if (toChest > 0) {
            contents[resId] = (contents[resId] || 0) + toChest;
            chestUpdates.set(c.id, contents);
            remaining -= toChest;
          }
        }
        if (remaining > 0) {
          throw new GameError(t("server.err.noRoomRefund"), 409);
        }
      }
    } else {
      craftedItems[placement.objectId] = (craftedItems[placement.objectId] || 0) + 1;
    }
    if (chest) await t2.Chest.delete(placementId);
    await t2.Placement.delete(placementId);
    if (refunded) {
      await t2.Player.patch(playerId, { inventory });
      for (const [cid, contents] of chestUpdates) await t2.Chest.patch(cid, { contents });
    } else {
      await t2.Player.patch(playerId, { craftedItems });
    }
    const recalc = placement.area !== "home" ? await recalcBiome(wid, playerId, placement.area, {
      removeIds: [placementId],
      player: { ...player, craftedItems, inventory }
    }) : null;
    await bumpMetrics(player, { objectsRemoved: 1, animalsReturned: recalc?.newAnimals?.length || 0 });
    await awardWorldAchievements(wid, playerId, recalc ? { addDiscoveries: recalc.newAnimals, freshBiomeStates: [recalc.biomeState] } : {});
    return { ok: true, removed: placementId, craftedItems, refunded, ...recalc || {} };
  }
};
var UpgradeTool = class extends PublicEndpoint {
  async post(data) {
    const { playerId, toolId } = await bodyOf(data);
    const t2 = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const toolDef = d.tool.get(toolId);
    if (!toolDef) throw new GameError(t("server.err.unknownTool", { tool: toolId }));
    const wid = worldOf(player);
    const currentTier = player.tools?.[toolId] || 1;
    const nextTier = (toolDef.tiers || []).find((tt) => tt.tier === currentTier + 1);
    if (!nextTier) throw new GameError(t("server.err.toolMaxed", { tool: toolDef.name }));
    if (nextTier.requires?.biome) {
      const bs = await findBiomeState(t2.BiomeState, wid, nextTier.requires.biome);
      if ((bs?.health || 0) < (nextTier.requires.minHealth || 0)) {
        const biome = d.biome.get(nextTier.requires.biome);
        throw new GameError(
          t("server.err.restoreFirst", { biome: biome?.name || nextTier.requires.biome, health: nextTier.requires.minHealth }),
          403
        );
      }
    }
    const { usedFrom, inventory } = await consumeMaterials(player, nextTier.materials || {}, wid);
    const tools = { ...player.tools || {}, [toolId]: nextTier.tier };
    await t2.Player.patch(playerId, { tools });
    const unlockedBiomes = await checkUnlocks(wid, playerId, { player: { ...player, tools } });
    const chests = await byWorld(t2.Chest, wid);
    await bumpMetrics(player, { toolsUpgraded: 1 });
    await awardAchievements(playerId);
    return { ok: true, tools, inventory, chests, usedFrom, unlockedBiomes, upgraded: { toolId, tier: nextTier.tier, name: nextTier.name } };
  }
};
var UpgradeHome = class extends PublicEndpoint {
  async post(data) {
    const { playerId, track } = await bodyOf(data);
    const t2 = db();
    const { player } = await requirePlayer(playerId);
    const wid = worldOf(player);
    const def = HOME_TRACKS[track];
    if (!def) throw new GameError(t("server.err.unknownHomeUpgrade"));
    const home = homeOf(player);
    if (!home.styleLocked) throw new GameError(t("server.err.buildStyleFirst"), 403);
    const level = home[track] || 1;
    const next = def.levels[level];
    if (!next) throw new GameError(t("server.err.trackMaxed", { track: def.name.toLowerCase() }));
    if (next.requires?.biome) {
      const bs = await findBiomeState(t2.BiomeState, wid, next.requires.biome);
      if ((bs?.health || 0) < (next.requires.minHealth || 0)) {
        const d = await defs();
        const biome = d.biome.get(next.requires.biome);
        throw new GameError(t("server.err.restoreFirst", { biome: biome?.name || next.requires.biome, health: next.requires.minHealth }), 403);
      }
    }
    const { usedFrom, inventory } = await consumeMaterials(player, next.materials || {}, wid);
    const updated = { ...home, [track]: level + 1 };
    await t2.Player.patch(playerId, { home: updated });
    const chests = await byWorld(t2.Chest, wid);
    await awardAchievements(playerId);
    await bumpMetrics(player, { homeUpgrades: 1 });
    return { ok: true, home: updated, inventory, chests, usedFrom, upgraded: { track, level: level + 1, name: def.name } };
  }
};
var SLEEP_OBJECTS = ["home-sleeping-bag", "home-bed"];
var Rest = class extends PublicEndpoint {
  async post(data) {
    const { playerId } = await bodyOf(data);
    const t2 = db();
    const { player } = await requirePlayer(playerId);
    const wid = worldOf(player);
    const placements = await byWorld(t2.Placement, wid);
    if (!placements.some((p) => SLEEP_OBJECTS.includes(p.objectId))) {
      throw new GameError(t("server.err.needBedToRest"), 403);
    }
    const nodes = await byWorld(t2.NodeState, wid);
    for (const n of nodes) await t2.NodeState.delete(n.id);
    const nowT = weatherTimeFromPlay(player);
    const skip = nextDawnAt(nowT) - nowT;
    await t2.Player.patch(playerId, { clockOffsetMs: (player.clockOffsetMs || 0) + skip });
    await bumpMetrics(player, { restsTaken: 1 });
    return { ok: true, rested: true, refreshed: nodes.length };
  }
};
var isHexColor = (c) => typeof c === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c.trim());
var SetHomeColors = class extends PublicEndpoint {
  async post(data) {
    const { playerId, colors } = await bodyOf(data);
    const t2 = db();
    const { player } = await requirePlayer(playerId);
    const home = homeOf(player);
    if (!home.styleLocked) throw new GameError(t("server.err.buildBeforeRepaint"), 403);
    const next = { ...home.colors };
    for (const k of ["floor", "wall", "accent", "rug"]) {
      if (colors?.[k] && isHexColor(colors[k])) next[k] = String(colors[k]).trim().toLowerCase();
    }
    await t2.Player.patch(playerId, { home: { ...home, colors: next } });
    await bumpMetrics(player, { recolors: 1 });
    return { ok: true };
  }
};
var SetPlacementColor = class extends PublicEndpoint {
  async post(data) {
    const { playerId, placementId, color } = await bodyOf(data);
    const t2 = db();
    const { player } = await requirePlayer(playerId);
    if (!homeOf(player).styleLocked) throw new GameError(t("server.err.buildBeforeRepaintThings"), 403);
    if (!isHexColor(color)) throw new GameError(t("server.err.invalidColor"));
    const placement = await findInWorld(t2.Placement, worldOf(player), placementId);
    if (!placement) throw new GameError(t("server.err.itemNotHere"), 404);
    await t2.Placement.patch(placementId, { color: String(color).trim().toLowerCase() });
    await bumpMetrics(player, { recolors: 1 });
    return { ok: true };
  }
};
var SetHomeStyle = class extends PublicEndpoint {
  async post(data) {
    const { playerId, style } = await bodyOf(data);
    const t2 = db();
    const { player } = await requirePlayer(playerId);
    const styleDef = HOME_STYLES[style];
    if (!styleDef) throw new GameError(t("server.err.unknownHomeStyle"));
    const home = homeOf(player);
    if (home.styleLocked) throw new GameError(t("server.err.homeAlreadyBuilt"), 403);
    const wid = worldOf(player);
    if (styleDef.requires?.biome) {
      const bs = await findBiomeState(t2.BiomeState, wid, styleDef.requires.biome);
      if ((bs?.health || 0) < (styleDef.requires.minHealth || 0)) {
        const d = await defs();
        const biome = d.biome.get(styleDef.requires.biome);
        throw new GameError(t("server.err.restoreFirst", { biome: biome?.name || styleDef.requires.biome, health: styleDef.requires.minHealth }), 403);
      }
    }
    const { usedFrom, inventory } = await consumeMaterials(player, styleDef.materials || {}, wid);
    const updated = { ...home, style, styleLocked: true, space: 2 };
    await t2.Player.patch(playerId, { home: updated });
    const chests = await byWorld(t2.Chest, wid);
    await awardAchievements(playerId);
    await bumpMetrics(player, { homesBuilt: 1 });
    return { ok: true, home: updated, inventory, chests, usedFrom, built: HOME_STYLES[style].name };
  }
};
var ObserveAnimal = class extends PublicEndpoint {
  async post(data) {
    const { playerId, animalId } = await bodyOf(data);
    const t2 = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const wid = worldOf(player);
    const disc = await findDiscovery(t2.Discovery, wid, animalId);
    if (!disc) throw new GameError(t("server.err.animalNotReturned"), 404);
    const dayKey = playerDayKey(player, Date.now());
    const firstToday = disc.lastObservedDayKey !== dayKey;
    const timesObserved = (disc.timesObserved || 0) + 1;
    await t2.Discovery.patch(disc.id, { timesObserved, lastObservedDayKey: dayKey });
    await bumpMetrics(player, { animalsObserved: 1 }, firstToday ? { observe: 1 } : {});
    await awardAchievements(playerId);
    return { ok: true, discovery: { ...disc, timesObserved }, animal: d.animal.get(animalId) };
  }
};
var ClaimTask = class extends PublicEndpoint {
  async post(data) {
    const { playerId, taskId } = await bodyOf(data);
    const t2 = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const wid = worldOf(player);
    const now = Date.now();
    const [discoveries, biomeStates, placements, chests] = await Promise.all([
      byWorld(t2.Discovery, wid),
      byWorld(t2.BiomeState, wid),
      byWorld(t2.Placement, wid),
      byWorld(t2.Chest, wid)
    ]);
    const block = dailyTasksBlock({ wid, player, d, discoveries, biomeStates, placements, chests, now, unlockedBiomes: player.unlockedBiomes });
    const task = block.tasks.find((x) => x.id === String(taskId || ""));
    if (!task) throw new GameError(t("server.err.taskNotOnBoard"), 404);
    if (task.pinned) throw new GameError(t("server.err.taskNotClaimable"), 409);
    if (task.claimed) throw new GameError(t("server.err.taskAlreadyClaimed"), 409);
    if (task.progress < task.target) throw new GameError(t("server.err.taskNotFinished"), 409);
    const capacity = inventoryCapacity(player);
    const inventory = { ...player.inventory || {} };
    let room = Math.max(0, capacity - sumValues(inventory));
    const gained = {};
    for (const [resId, qty] of Object.entries(task.reward || {})) {
      const take = Math.min(qty, room);
      if (take <= 0) continue;
      inventory[resId] = (inventory[resId] || 0) + take;
      gained[resId] = take;
      room -= take;
    }
    if (!Object.keys(gained).length) throw new GameError(t("server.err.basketFullReward"), 409);
    const isStarter = String(task.id).startsWith("start-");
    const isUnlockReward = String(task.id).startsWith("unlock-reward:");
    const patch = { inventory };
    if (isUnlockReward) {
      const bid = String(task.id).slice("unlock-reward:".length);
      patch.pendingUnlockRewards = (player.pendingUnlockRewards || []).filter((id) => id !== bid);
    } else if (isStarter) {
      patch.goalClaims = { ...player.goalClaims || {}, [task.id]: true };
    } else {
      patch.customGoals = (player.customGoals || []).filter((g) => g.id !== task.id);
    }
    await t2.Player.patch(playerId, patch);
    await bumpMetrics(player, { tasksCompleted: 1 });
    await awardAchievements(playerId);
    const dailyTasks = {
      ...block,
      tasks: block.tasks.map((x) => x.id === task.id ? { ...x, claimed: true } : x)
    };
    return { ok: true, taskId: task.id, text: task.text, gained, inventory, dailyTasks };
  }
};
var SetGoals = class extends PublicEndpoint {
  async post(data) {
    const { playerId, goals } = await bodyOf(data);
    const { player } = await requirePlayer(playerId);
    const t2 = db();
    const d = await defs();
    const wid = worldOf(player);
    const now = Date.now();
    const [discoveries, biomeStates, placements, chests] = await Promise.all([
      byWorld(t2.Discovery, wid),
      byWorld(t2.BiomeState, wid),
      byWorld(t2.Placement, wid),
      byWorld(t2.Chest, wid)
    ]);
    const ctx = { wid, player, d, discoveries, biomeStates, placements, chests, now, unlockedBiomes: player.unlockedBiomes };
    const prev = new Map((player.customGoals || []).map((g) => [g.id, g]));
    const limit = goalLimitFor(player, d);
    const cleaned = sanitizeGoals(goals, d);
    const keep = [];
    for (const g of cleaned) {
      const existing = prev.get(g.id);
      if (!existing && keep.length >= limit) continue;
      if (keep.length >= MAX_CUSTOM_GOALS) break;
      const base = existing && typeof existing.base === "number" ? existing.base : goalMetric(g, ctx);
      const out = { ...g, base };
      if (g.kind === "build") {
        out.basePlace = existing && typeof existing.basePlace === "number" ? existing.basePlace : placedCountFor(ctx, g.itemId || "");
      }
      keep.push(out);
    }
    await t2.Player.patch(playerId, { customGoals: keep });
    return { ok: true, customGoals: keep, goalLimit: limit };
  }
};
var Terraform = class extends PublicEndpoint {
  async post(data) {
    const { playerId, area, x, y, action } = await bodyOf(data);
    const t2 = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const wid = worldOf(player);
    const biome = d.biome.get(area);
    if (!biome) throw new GameError(t("server.err.terraformOutdoors"));
    if (!(player.unlockedBiomes || []).includes(area)) throw new GameError(t("server.err.biomeLocked", { biome: biome.name }), 403);
    const tx = Math.round(Number(x));
    const ty = Math.round(Number(y));
    const grid = areaGrid(d, area);
    if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 1 || ty < 1 || tx > grid.cols - 2 || ty > grid.rows - 2) {
      throw new GameError(t("server.err.outOfReach"));
    }
    const placements = await byWorld(t2.Placement, wid);
    if (placements.some((p) => p.area === area && p.x === tx && p.y === ty)) {
      throw new GameError(t("server.err.somethingPlaced"));
    }
    const tileId = `${wid}:${area}:${tx}:${ty}`;
    const existing = await findTerrainAt(t2.TerrainTile, wid, area, tx, ty);
    let inventory = player.inventory || {};
    let tile = null;
    let removedId;
    let dug = null;
    if (action === "dig") {
      if ((player.tools?.shovel || 0) < 1) throw new GameError(t("server.err.needShovel"));
      if (existing) throw new GameError(t("server.err.alreadyPrepared"));
      tile = { id: tileId, worldId: wid, playerId, area, x: tx, y: ty, type: "tilled", updatedAt: Date.now() };
      await t2.TerrainTile.put(tile);
      const pool = biome.digResources || [];
      if (pool.length && Math.random() < DIG_FIND_CHANCE) {
        const resId = pool[Math.floor(Math.random() * pool.length)];
        const room = Math.max(0, inventoryCapacity(player) - sumValues(inventory));
        const amount = Math.min(player.tools?.shovel || 1, room);
        if (amount > 0) {
          inventory = { ...inventory, [resId]: (inventory[resId] || 0) + amount };
          await t2.Player.patch(playerId, { inventory });
          dug = { resourceId: resId, amount };
        }
      }
    } else if (action === "water") {
      if ((player.tools?.["watering-can"] || 0) < 1) throw new GameError(t("server.err.needWateringCan"));
      if (!existing) throw new GameError(t("server.err.prepareBedFirst"));
      if (existing.type === "water") throw new GameError(t("server.err.alreadyOpenWater"));
      const cost = 1;
      const newType = existing.type === "tilled" ? "watered" : "water";
      if (newType === "water" && biome.canFlood === false) {
        throw new GameError(t("server.err.tooDryToFlood", { biome: biome.name }));
      }
      const have = (inventory.water || 0) + (inventory["clean-water"] || 0);
      if (have < cost) throw new GameError(t("server.err.needWater", { count: cost }));
      inventory = { ...inventory };
      let remaining = cost;
      for (const key of ["water", "clean-water"]) {
        const take = Math.min(inventory[key] || 0, remaining);
        if (take > 0) {
          inventory[key] -= take;
          if (inventory[key] <= 0) delete inventory[key];
          remaining -= take;
        }
      }
      await t2.Player.patch(playerId, { inventory });
      tile = { ...existing, type: newType, updatedAt: Date.now() };
      await t2.TerrainTile.patch(existing.id, { type: newType, updatedAt: Date.now() });
    } else if (action === "clear") {
      if (!existing) throw new GameError(t("server.err.nothingToClear"));
      await t2.TerrainTile.delete(existing.id);
      removedId = existing.id;
    } else {
      throw new GameError(t("server.err.badTerraformAction"));
    }
    const recalc = await recalcBiome(wid, playerId, area, {
      addTerrain: tile ? [tile] : [],
      removeTerrainIds: removedId ? [removedId] : [],
      player: { ...player, inventory }
    });
    await bumpMetrics(player, { terraformActions: 1, animalsReturned: recalc.newAnimals?.length || 0 }, action === "water" ? { water: 1 } : {});
    await awardWorldAchievements(wid, playerId, { addDiscoveries: recalc.newAnimals, freshBiomeStates: [recalc.biomeState] });
    return { ok: true, tile, removedId, dug, inventory, ...recalc };
  }
};
var RecalcBiome = class extends PublicEndpoint {
  async post(data) {
    const { playerId, biomeId } = await bodyOf(data);
    const { player } = await requirePlayer(playerId);
    const recalcResult = await recalcBiome(worldOf(player), playerId, biomeId);
    await awardWorldAchievements(worldOf(player), playerId, { addDiscoveries: recalcResult.newAnimals, freshBiomeStates: [recalcResult.biomeState] });
    return { ok: true, ...recalcResult };
  }
};
var SyncPlayer = class extends PublicEndpoint {
  async post(data) {
    const { playerId, x, y, area, tutorialStep } = await bodyOf(data);
    const t2 = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const patch = {};
    if (Number.isFinite(Number(x))) patch.x = Number(x);
    if (Number.isFinite(Number(y))) patch.y = Number(y);
    if (Number.isInteger(tutorialStep) && tutorialStep >= 0 && tutorialStep <= 99) {
      patch.tutorialStep = tutorialStep;
      patch.tutorialMaxStep = Math.max(player.tutorialMaxStep ?? 0, player.tutorialStep ?? 0, tutorialStep);
    }
    if (area === "home") {
      patch.area = "home";
    } else if (area) {
      const biome = d.biome.get(area);
      if (!biome) throw new GameError(t("server.err.unknownArea", { area }));
      if (!(player.unlockedBiomes || []).includes(area)) {
        throw new GameError(t("server.err.biomeLocked", { biome: biome.name }), 403);
      }
      if (!biome.explorable) {
        throw new GameError(t("server.err.notExplorable", { biome: biome.name }), 403);
      }
      patch.area = area;
      const visited = player.visitedBiomes || ["meadow"];
      if (!visited.includes(area)) patch.visitedBiomes = [...visited, area];
      if (STARTING_TERRAIN[area]) {
        const wid = worldOf(player);
        const hasTerrain = (await byWorld(t2.TerrainTile, wid)).some((tt) => tt.area === area);
        if (!hasTerrain) {
          await seedStartingTerrain(wid, playerId, area);
          await recalcBiome(wid, playerId, area, { player });
        }
      }
    }
    await t2.Player.patch(playerId, patch);
    if (patch.tutorialStep !== void 0) await awardAchievements(playerId);
    return { ok: true, player: sanitizePlayer(await t2.Player.get(playerId)) };
  }
};
var AppendFeed = class extends PublicEndpoint {
  async post(data) {
    const { playerId, entries } = await bodyOf(data);
    const { player } = await requirePlayer(playerId);
    const wid = worldOf(player);
    const t2 = db();
    const list = Array.isArray(entries) ? entries.slice(0, FEED_CAP) : [];
    let added = 0;
    for (const e of list) {
      const text = String(e?.text || "").slice(0, 500).trim();
      if (!text) continue;
      const at = Number(e?.at) || Date.now();
      const icon = String(e?.icon || "leaf").slice(0, 40);
      const id = `f_${wid}_${at}_${Math.random().toString(36).slice(2, 9)}`;
      await t2.FeedEntry.put({ id, worldId: wid, playerId, at, icon, text });
      added++;
    }
    const all = (await byWorld(t2.FeedEntry, wid)).sort((a, b) => (a.at || 0) - (b.at || 0));
    if (all.length > FEED_CAP) {
      for (const old of all.slice(0, all.length - FEED_CAP)) await t2.FeedEntry.delete(old.id);
    }
    return { ok: true, added };
  }
};
var SESSION_GAP_MS = 30 * 60 * 1e3;
var MAX_BEAT_MS = 90 * 1e3;
var Heartbeat = class extends PublicEndpoint {
  async post(data) {
    const { playerId, language } = await bodyOf(data);
    const t2 = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const now = Date.now();
    const prev = player.metrics || freshMetrics(player.createdAt || now);
    const lang = typeof language === "string" && language.trim() ? language.trim().toLowerCase().slice(0, 12) : null;
    const last = prev.lastHeartbeatAt || 0;
    const gap = now - last;
    let playSeconds = prev.playSeconds || 0;
    let sessions = prev.sessions || 0;
    const newSession = last === 0 || gap > SESSION_GAP_MS;
    if (newSession) {
      sessions += 1;
    } else {
      playSeconds += Math.min(gap, MAX_BEAT_MS) / 1e3;
    }
    const metrics = {
      ...prev,
      firstSeenAt: prev.firstSeenAt || player.createdAt || now,
      lastSeenAt: now,
      lastHeartbeatAt: now,
      playSeconds: Math.round(playSeconds),
      sessions,
      ...lang ? { language: lang } : {}
    };
    await t2.Player.patch(playerId, { metrics });
    const wid = worldOf(player);
    let welcomeBack = null;
    const newAnimals = [];
    const freshBiomeStates = [];
    try {
      const awaySince = prev.lastSeenAt || 0;
      const longAway = newSession && awaySince > 0 && now - awaySince > 10 * 6e4;
      const placements = await byWorld(t2.Placement, wid);
      const sinceBeat = last > 0 ? last : now;
      const crossed = /* @__PURE__ */ new Set();
      for (const p of placements) {
        const def = d.object.get(p.objectId);
        if (maturedBetween(def, p, longAway ? awaySince : sinceBeat, now)) crossed.add(p.area);
      }
      const biomeStates = await byWorld(t2.BiomeState, wid);
      const unlockedIds = new Set(biomeStates.filter((b) => b.unlocked).map((b) => b.biomeId));
      const toRecalc = longAway ? [...unlockedIds] : [...crossed].filter((b) => unlockedIds.has(b));
      let healthGain = 0;
      for (const biomeId of toRecalc) {
        const before = biomeStates.find((b) => b.biomeId === biomeId)?.health || 0;
        const r = await recalcBiome(wid, playerId, biomeId, { player });
        healthGain += Math.max(0, (r.biomeState?.health || 0) - before);
        newAnimals.push(...r.newAnimals || []);
        freshBiomeStates.push(r.biomeState);
      }
      if (newAnimals.length || freshBiomeStates.length) {
        await awardWorldAchievements(wid, playerId, { addDiscoveries: newAnimals, freshBiomeStates });
      }
      if (longAway) {
        const matured = placements.filter((p) => {
          const def = d.object.get(p.objectId);
          return unlockedIds.has(p.area) && maturedBetween(def, p, awaySince, now);
        }).length;
        if (matured > 0 || newAnimals.length > 0 || healthGain > 0) {
          welcomeBack = {
            awayHours: Math.round((now - awaySince) / 36e5 * 10) / 10,
            matured,
            healthGain,
            arrivals: newAnimals.map((n) => n.animal?.name).filter(Boolean)
          };
        }
      }
    } catch (e) {
      console.error("heartbeat growth pass skipped:", e);
    }
    await awardAchievements(playerId);
    return {
      ok: true,
      metrics: metricsView({ ...player, metrics }),
      ...newAnimals.length ? { newAnimals } : {},
      ...freshBiomeStates.length ? { biomeStates: freshBiomeStates } : {},
      ...welcomeBack ? { welcomeBack } : {}
    };
  }
};
var dashboardCache = null;
var DASHBOARD_CACHE_MS = 3e4;
var Metrics = class extends PublicEndpoint {
  async get(target) {
    const t2 = db();
    const id = String(this.getId?.() || target?.id || "").trim();
    if (id) {
      const player = await t2.Player.get(id);
      if (!player) throw new GameError(t("server.err.noSaveWithId"), 404);
      const bm = await biomeMetrics(id);
      const view = metricsView(player);
      return {
        player: {
          ...view,
          biomeSummary: bm.summary,
          activation: activationFlags(view, bm.summary, player),
          achievements: await achievementMetrics(id),
          biomes: bm.biomes
        }
      };
    }
    const now = Date.now();
    let all;
    if (dashboardCache && now - dashboardCache.at < DASHBOARD_CACHE_MS) {
      all = dashboardCache.all;
    } else {
      let soloRows = [];
      try {
        soloRows = await allOf(t2.SoloMetrics);
      } catch {
      }
      all = soloRows.map((r) => {
        let s = {};
        if (r.snapshot) {
          try {
            s = typeof r.snapshot === "string" ? JSON.parse(r.snapshot) : r.snapshot;
          } catch {
            s = {};
          }
        }
        const lastSeenAt = s.lastSeenAt || r.updatedAt || null;
        const createdAt = s.createdAt || r.createdAt || now;
        const hoursSinceActive = lastSeenAt ? round1((now - lastSeenAt) / 36e5) : null;
        let status = "dormant";
        if (hoursSinceActive != null) {
          if (hoursSinceActive <= 24) status = "active";
          else if (hoursSinceActive <= 24 * 7) status = "recent";
        }
        return {
          ...s,
          playerId: r.id,
          // slot-scoped id — solo name slugs can collide across machines
          name: r.name || s.name || null,
          solo: true,
          platform: r.platform || null,
          os: r.os || null,
          language: r.language || s.language || null,
          version: r.version || null,
          build: r.build || null,
          lastSyncedAt: r.updatedAt || null,
          counts: s.counts || {},
          playSeconds: s.playSeconds || 0,
          sessions: s.sessions || 0,
          totalActions: s.totalActions || 0,
          currentArea: s.currentArea || null,
          unlockedBiomes: s.unlockedBiomes || 0,
          tutorialStep: s.tutorialStep || 0,
          activation: s.activation || {},
          achievements: s.achievements || null,
          biomeSummary: s.biomeSummary || { biomesUnlocked: 0, avgHealth: 0, biomesFullyRestored: 0, totalAnimalsReturned: 0 },
          createdAt,
          lastSeenAt,
          hoursSinceActive,
          status,
          daysSinceJoined: Math.floor((now - createdAt) / DAY_MS2),
          isNewToday: now - createdAt <= DAY_MS2
        };
      }).sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0) || b.playSeconds - a.playSeconds);
      dashboardCache = { at: now, all };
    }
    const excludedNames = /* @__PURE__ */ new Set();
    try {
      const raw = typeof target?.getAll === "function" ? [...target.getAll("exclude"), ...target.getAll("excludeName")] : [];
      for (const part of raw.flatMap((s) => String(s).split(","))) {
        const n = part.trim().toLowerCase();
        if (n) excludedNames.add(n);
      }
    } catch {
    }
    if (excludedNames.size) all = all.filter((v) => !excludedNames.has(String(v.name || "").trim().toLowerCase()));
    const N = all.length || 1;
    const pct = (n) => Math.round(n / N * 100);
    const actionTotals = {};
    for (const v of all) {
      for (const [k, n] of Object.entries(v.counts)) actionTotals[k] = (actionTotals[k] || 0) + n;
    }
    const totalPlaySeconds = all.reduce((acc, v) => acc + v.playSeconds, 0);
    const totalSessions = all.reduce((acc, v) => acc + v.sessions, 0);
    const totalActions = all.reduce((acc, v) => acc + v.totalActions, 0);
    const audience = {
      activeLast24h: all.filter((v) => v.status === "active").length,
      activeLast7d: all.filter((v) => v.status === "active" || v.status === "recent").length,
      dormant: all.filter((v) => v.status === "dormant").length,
      newLast24h: all.filter((v) => now - v.createdAt <= DAY_MS2).length,
      newLast7d: all.filter((v) => now - v.createdAt <= 7 * DAY_MS2).length
    };
    const tally = (pick) => {
      const out = {};
      for (const v of all) {
        const k = pick(v) || "unknown";
        out[k] = (out[k] || 0) + 1;
      }
      return out;
    };
    const languages = tally((v) => v.language || "en");
    const platforms = tally((v) => v.platform);
    const operatingSystems = tally((v) => v.os);
    const versions = tally((v) => v.version);
    const returningPlayers = all.filter((v) => v.sessions >= 2).length;
    const funnel = {
      created: all.length,
      collected: all.filter((v) => v.activation?.collected).length,
      crafted: all.filter((v) => v.activation?.crafted).length,
      placed: all.filter((v) => v.activation?.placed).length,
      attractedAnimal: all.filter((v) => v.activation?.attractedAnimal).length,
      unlockedSecondBiome: all.filter((v) => v.activation?.unlockedSecondBiome).length
    };
    const funnelPct = {
      collected: pct(funnel.collected),
      crafted: pct(funnel.crafted),
      placed: pct(funnel.placed),
      attractedAnimal: pct(funnel.attractedAnimal),
      unlockedSecondBiome: pct(funnel.unlockedSecondBiome)
    };
    const areaTally = {};
    for (const v of all) if (v.currentArea) areaTally[v.currentArea] = (areaTally[v.currentArea] || 0) + 1;
    const mostPopularArea = Object.entries(areaTally).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const tutorialTally = {};
    for (const v of all) {
      const k = String(v.tutorialStep || 0);
      tutorialTally[k] = (tutorialTally[k] || 0) + 1;
    }
    const withBiomes = all.filter((v) => (v.biomeSummary?.biomesUnlocked || 0) > 0);
    const avgBiomeHealth = withBiomes.length ? Math.round(withBiomes.reduce((acc, v) => acc + (v.biomeSummary.avgHealth || 0), 0) / withBiomes.length) : 0;
    const withAch = all.filter((v) => v.achievements);
    const totalEarned = withAch.reduce((acc, v) => acc + (v.achievements.earned || 0), 0);
    const recentDistribution = {};
    const byCategory = {};
    const completionHistogram = {};
    for (const v of withAch) {
      for (const rec of v.achievements.recent || []) if (rec?.id) recentDistribution[rec.id] = (recentDistribution[rec.id] || 0) + 1;
      for (const [cat, n] of Object.entries(v.achievements.byCategory || {})) byCategory[cat] = (byCategory[cat] || 0) + n;
      const e = v.achievements.earned || 0;
      const bucket = e === 0 ? "0" : `${Math.floor((e - 1) / 10) * 10 + 1}-${(Math.floor((e - 1) / 10) + 1) * 10}`;
      completionHistogram[bucket] = (completionHistogram[bucket] || 0) + 1;
    }
    const achievementsSummary = {
      totalDefined: withAch.reduce((m, v) => Math.max(m, v.achievements.total || 0), 0),
      totalEarned,
      avgPerPlayer: round1(totalEarned / (withAch.length || 1)),
      avgCompletionPct: withAch.length ? Math.round(withAch.reduce((a, v) => a + (v.achievements.completion || 0), 0) / withAch.length * 100) : 0,
      avgPoints: round1(withAch.reduce((a, v) => a + (v.achievements.points || 0), 0) / (withAch.length || 1)),
      byCategory,
      recentDistribution,
      completionHistogram
    };
    return {
      generatedAt: now,
      source: "solo-metrics",
      summary: {
        players: all.length,
        soloPlayers: all.length,
        excludedNames: [...excludedNames],
        audience,
        languages,
        platforms,
        operatingSystems,
        versions,
        engagement: {
          totalPlayHours: round1(totalPlaySeconds / 3600),
          totalPlaySeconds,
          avgPlayMinutesPerPlayer: Math.round(totalPlaySeconds / 60 / N),
          totalSessions,
          avgSessionsPerPlayer: round1(totalSessions / N),
          avgSessionMinutes: totalSessions ? Math.round(totalPlaySeconds / 60 / totalSessions) : 0,
          totalActions,
          avgActionsPerPlayer: round1(totalActions / N)
        },
        retention: {
          returningPlayers,
          returningRatePct: pct(returningPlayers)
        },
        progression: {
          avgBiomeHealth,
          biomesFullyRestored: all.reduce((acc, v) => acc + (v.biomeSummary?.biomesFullyRestored || 0), 0),
          avgUnlockedBiomes: round1(all.reduce((acc, v) => acc + (v.unlockedBiomes || 0), 0) / N),
          mostPopularArea,
          tutorialStepHistogram: tutorialTally
        },
        funnel,
        funnelPct,
        actionTotals,
        achievements: achievementsSummary
      },
      players: all
    };
  }
};
var BiomeSnapshot = class extends PublicEndpoint {
  async get() {
    const id = String(this.getId?.() || "").trim();
    if (!id) throw new GameError(t("server.err.snapshotPathId"));
    await requirePlayer(id);
    const t2 = db();
    const d = await defs();
    const states = (await byPlayer(t2.BiomeState, id)).filter((s) => s.unlocked);
    const placements = await byPlayer(t2.Placement, id);
    const terrain = await byPlayer(t2.TerrainTile, id);
    const areas = states.map((s) => {
      const biome = d.biome.get(s.biomeId);
      const pls = placements.filter((p) => p.area === s.biomeId);
      const ter = terrain.filter((tt) => tt.area === s.biomeId);
      const svg = renderBiomeSVG(d, biome, s.health || 0, pls, ter);
      return {
        area: s.biomeId,
        name: biome?.name || s.biomeId,
        health: s.health || 0,
        placements: pls.length,
        image: svgDataUri(svg),
        svg
      };
    });
    return { ok: true, playerId: id, areas };
  }
};
var DevTools = class extends PublicEndpoint {
  async post(data) {
    const { playerId, action, area, amount, value, resources, animalId } = await bodyOf(data);
    const t2 = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const log = [];
    switch (action) {
      case "set-time": {
        const phase = String(value || "dawn");
        const nowT = weatherTimeFromPlay(player);
        const skip = nextPhaseAt(nowT, phase) - nowT;
        await t2.Player.patch(playerId, { clockOffsetMs: (player.clockOffsetMs || 0) + skip });
        log.push(`Set time to ${phase}`);
        break;
      }
      case "seed-water": {
        const ar = area || "wetland";
        for (const tt of (await byPlayer(t2.TerrainTile, playerId)).filter((x) => x.area === ar)) {
          await t2.TerrainTile.delete(tt.id);
        }
        await seedStartingTerrain(playerId, playerId, ar);
        await recalcBiome(playerId, playerId, ar, { player });
        log.push(`Reseeded starting terrain for ${ar}`);
        break;
      }
      case "clear-terrain": {
        const ar = area || player.area;
        let n = 0;
        for (const tt of (await byPlayer(t2.TerrainTile, playerId)).filter((x) => x.area === ar)) {
          await t2.TerrainTile.delete(tt.id);
          n++;
        }
        await recalcBiome(playerId, playerId, ar, { player });
        log.push(`Cleared ${n} terrain tiles in ${ar}`);
        break;
      }
      case "grant-resources": {
        const inventory = { ...player.inventory || {} };
        const valid = new Set(d.resources.map((r) => r.id));
        let granted = 0;
        if (resources && typeof resources === "object") {
          for (const [id, qty] of Object.entries(resources)) {
            const n = Math.floor(Number(qty) || 0);
            if (n > 0 && valid.has(id)) {
              inventory[id] = (inventory[id] || 0) + n;
              granted++;
            }
          }
          log.push(`Granted ${granted} resource type${granted === 1 ? "" : "s"}`);
        } else {
          const give = Math.max(1, Number(amount) || 200);
          for (const r of d.resources) inventory[r.id] = (inventory[r.id] || 0) + give;
          log.push(`Granted ${give} of every resource`);
        }
        await t2.Player.patch(playerId, { inventory });
        break;
      }
      case "max-tools": {
        const tools = { ...player.tools || {} };
        for (const tool of d.tools) {
          const top = Math.max(...tool.tiers.map((ti) => ti.tier));
          tools[tool.id] = top;
        }
        await t2.Player.patch(playerId, { tools });
        log.push("All tools set to max tier");
        break;
      }
      case "unlock-all": {
        const ids = d.biomes.map((b) => b.id);
        await t2.Player.patch(playerId, { unlockedBiomes: ids });
        for (const id of ids) await t2.BiomeState.patch(`${playerId}:${id}`, { unlocked: true });
        log.push(`Unlocked all biomes (${ids.length})`);
        break;
      }
      case "unlock-next": {
        const sorted = [...d.biomes].sort((a, b) => (a.order || 0) - (b.order || 0));
        const unlocked = new Set(player.unlockedBiomes || ["meadow"]);
        const nextB = sorted.find((b) => !unlocked.has(b.id));
        if (!nextB) {
          log.push("Every biome is already unlocked");
          break;
        }
        unlocked.add(nextB.id);
        await t2.Player.patch(playerId, { unlockedBiomes: [...unlocked] });
        await t2.BiomeState.patch(`${playerId}:${nextB.id}`, { unlocked: true });
        await seedStartingTerrain(playerId, playerId, nextB.id);
        log.push(`Unlocked the next area: ${nextB.name}`);
        break;
      }
      case "relock-all": {
        await t2.Player.patch(playerId, { unlockedBiomes: ["meadow"] });
        for (const b of d.biomes) await t2.BiomeState.patch(`${playerId}:${b.id}`, { unlocked: b.id === "meadow" });
        log.push("Re-locked every biome except the meadow");
        break;
      }
      case "reset-tools": {
        await t2.Player.patch(playerId, { tools: { ...START_TOOLS } });
        log.push("Tools reset to tier 1");
        break;
      }
      case "restart-game": {
        const wid = playerId;
        for (const pl of await byPlayer(t2.Placement, playerId)) await t2.Placement.delete(pl.id);
        for (const ch of await byPlayer(t2.Chest, playerId)) await t2.Chest.delete(ch.id);
        for (const tt of await byPlayer(t2.TerrainTile, playerId)) await t2.TerrainTile.delete(tt.id);
        for (const disc of await byPlayer(t2.Discovery, playerId)) await t2.Discovery.delete(disc.id);
        for (const ns of await byPlayer(t2.NodeState, playerId)) await t2.NodeState.delete(ns.id);
        for (const fe of await byPlayer(t2.FeedEntry, playerId)) await t2.FeedEntry.delete(fe.id);
        for (const pa of await byPlayer(t2.PlayerAchievement, playerId)) await t2.PlayerAchievement.delete(pa.id);
        for (const b of d.biomes) {
          await t2.BiomeState.put({
            id: `${wid}:${b.id}`,
            worldId: wid,
            playerId,
            biomeId: b.id,
            health: BASE_HEALTH,
            balance: 0,
            returnedCount: 0,
            unlocked: b.id === "meadow"
          });
        }
        const chestId = `pl_${playerId}_starter-chest`;
        await t2.Placement.put({ id: chestId, worldId: wid, playerId, objectId: "small-chest", area: "meadow", x: STARTER_CHEST.x, y: STARTER_CHEST.y, placedAt: Date.now() });
        await t2.Chest.put({ id: chestId, worldId: wid, playerId, area: "meadow", x: STARTER_CHEST.x, y: STARTER_CHEST.y, size: "small-chest", capacity: STARTER_CHEST.capacity, contents: {} });
        await t2.Player.patch(playerId, {
          area: "meadow",
          x: 24.5,
          y: 6.5,
          inventory: { ...START_INVENTORY },
          craftedItems: {},
          craftedEver: {},
          tools: { ...START_TOOLS },
          unlockedBiomes: ["meadow"],
          visitedBiomes: ["meadow"],
          tutorialStep: 0,
          home: { ...DEFAULT_HOME },
          customGoals: [],
          goalClaims: {},
          devUnlockAll: false
        });
        log.push("Restarted the game \u2014 fresh save (name, passcode & look kept)");
        break;
      }
      case "build-home": {
        const style = value && HOME_STYLES[value] ? value : "cabin";
        const home = { ...homeOf(player), style, space: Math.max(2, homeOf(player).space || 1), styleLocked: true };
        await t2.Player.patch(playerId, { home });
        log.push(`Built home: ${HOME_STYLES[style].name}`);
        break;
      }
      case "max-home": {
        const home = {
          style: value && HOME_STYLES[value] ? value : homeOf(player).style || "cabin",
          space: HOME_TRACKS.space.levels.length,
          comfort: HOME_TRACKS.comfort.levels.length,
          decor: HOME_TRACKS.decor.levels.length,
          light: HOME_TRACKS.light.levels.length,
          styleLocked: true
        };
        await t2.Player.patch(playerId, { home });
        log.push("Home maxed on every track");
        break;
      }
      case "reset-home": {
        await t2.Player.patch(playerId, { home: { ...DEFAULT_HOME } });
        log.push("Home reset to the starter tent");
        break;
      }
      case "set-health": {
        const ar = area || player.area;
        const h = Math.max(0, Math.min(100, Number(value) || 100));
        await t2.BiomeState.patch(`${playerId}:${ar}`, { health: h });
        log.push(`Set ${ar} health to ${h}% (recomputes on next change)`);
        break;
      }
      case "reset-biome": {
        const ar = area || player.area;
        let placementsRemoved = 0;
        for (const pl of (await byPlayer(t2.Placement, playerId)).filter((x) => x.area === ar)) {
          if (d.object.get(pl.objectId)?.isChest) continue;
          await t2.Placement.delete(pl.id);
          placementsRemoved++;
        }
        for (const tt of (await byPlayer(t2.TerrainTile, playerId)).filter((x) => x.area === ar)) {
          await t2.TerrainTile.delete(tt.id);
        }
        let animalsRemoved = 0;
        for (const disc of (await byPlayer(t2.Discovery, playerId)).filter((x) => x.biomeId === ar)) {
          await t2.Discovery.delete(disc.id);
          animalsRemoved++;
        }
        const nodePrefix = `${playerId}:${ar}:`;
        for (const ns of (await byPlayer(t2.NodeState, playerId)).filter((x) => String(x.id).startsWith(nodePrefix))) {
          await t2.NodeState.delete(ns.id);
        }
        await t2.BiomeState.patch(`${playerId}:${ar}`, { health: BASE_HEALTH, balance: 0, returnedCount: 0 });
        await seedStartingTerrain(playerId, playerId, ar);
        await recalcBiome(playerId, playerId, ar, { player });
        log.push(`Reset ${ar} to its damaged state \u2014 removed ${placementsRemoved} object${placementsRemoved === 1 ? "" : "s"} and sent ${animalsRemoved} animal${animalsRemoved === 1 ? "" : "s"} away (chests kept)`);
        break;
      }
      case "lock-biome": {
        const ar = area || player.area;
        if (ar === "meadow") throw new GameError(t("server.err.meadowCannotLock"));
        const unlocked = (player.unlockedBiomes || []).filter((b) => b !== ar);
        await t2.Player.patch(playerId, { unlockedBiomes: unlocked });
        await t2.BiomeState.patch(`${playerId}:${ar}`, { unlocked: false });
        log.push(`Locked ${ar} again (unlock requirements must be met to re-enter)`);
        break;
      }
      case "unlock-recipes": {
        const next = value === void 0 ? !player.devUnlockAll : !!value;
        await t2.Player.patch(playerId, { devUnlockAll: next });
        log.push(next ? "All recipes unlocked (gates ignored)" : "Recipe progress gates restored");
        break;
      }
      case "welcome-animals": {
        const ar = area || player.area;
        const here = d.animals.filter((a) => a.biome === ar);
        const already = new Set((await byPlayer(t2.Discovery, playerId)).filter((x) => x.biomeId === ar).map((x) => x.animalId));
        let added = 0;
        for (const animal of here) {
          if (already.has(animal.id)) continue;
          await t2.Discovery.put({
            id: `${playerId}:${animal.id}`,
            playerId,
            animalId: animal.id,
            biomeId: ar,
            comfort: 3,
            timesObserved: 0,
            firstObservedAt: Date.now(),
            whyReturned: whyReturnedText(animal, d)
          });
          added++;
        }
        await recalcBiome(playerId, playerId, ar, { player });
        log.push(`Welcomed ${added} animal${added === 1 ? "" : "s"} to ${ar} (${here.length} total)`);
        break;
      }
      case "spawn-animal": {
        const animal = d.animals.find((a) => a.id === animalId);
        if (!animal) throw new GameError(t("server.err.unknownAnimal", { animal: animalId }));
        const discId = `${playerId}:${animal.id}`;
        const existing = await t2.Discovery.get(discId);
        if (!existing) {
          await t2.Discovery.put({
            id: discId,
            playerId,
            animalId: animal.id,
            biomeId: animal.biome,
            comfort: 85,
            timesObserved: 1,
            firstObservedAt: Date.now(),
            whyReturned: whyReturnedText(animal, d)
          });
        }
        const unlocked = player.unlockedBiomes || ["meadow"];
        if (!unlocked.includes(animal.biome)) {
          await t2.Player.patch(playerId, { unlockedBiomes: [...unlocked, animal.biome] });
        }
        await recalcBiome(playerId, playerId, animal.biome, { player });
        await t2.Discovery.patch(discId, { comfort: 85 });
        log.push(`Spawned ${animal.name} in ${animal.biome} \u2014 comfort 85, biome unlocked`);
        break;
      }
      case "populate-biome": {
        const ar = area || player.area;
        const biome = d.biome.get(ar);
        if (!biome || ar === "home") throw new GameError(t("server.err.cannotPopulate", { area: ar }));
        const wid = worldOf(player);
        const unlockedSet = new Set(player.unlockedBiomes || ["meadow"]);
        if (!unlockedSet.has(ar)) {
          unlockedSet.add(ar);
          await t2.Player.patch(playerId, { unlockedBiomes: [...unlockedSet] });
        }
        for (const pl of (await byWorld(t2.Placement, wid)).filter((p) => p.area === ar)) {
          if (d.object.get(pl.objectId)?.isChest) continue;
          await t2.Placement.delete(pl.id);
        }
        for (const tt of (await byWorld(t2.TerrainTile, wid)).filter((x) => x.area === ar)) {
          await t2.TerrainTile.delete(tt.id);
        }
        const grid = areaGrid(d, ar);
        const playTop = ar === "alpine" ? ALPINE_MTN_ROWS : 0;
        const landRight = ar === "coastal" ? grid.cols - (biome.oceanCols || 0) : grid.cols;
        const xMin = 2, xMax = landRight - 2;
        const yMin = playTop + 2, yMax = grid.rows - 2;
        const inCamp = (x, y) => ar === "meadow" && x >= 19 && x <= 24 && y >= 3 && y <= 6;
        const OLD = Date.now() - 45 * 864e5;
        const rng = seededRng(hash32(`populate:${wid}:${ar}`));
        const ri = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
        const pick = (arr) => arr[Math.floor(rng() * arr.length)];
        const occupied = /* @__PURE__ */ new Set();
        (await byWorld(t2.Chest, wid)).filter((c) => c.area === ar).forEach((c) => occupied.add(`${c.x},${c.y}`));
        const free = (x, y) => x >= xMin && x <= xMax && y >= yMin && y <= yMax && !inCamp(x, y) && !occupied.has(`${x},${y}`);
        const waterCells = [];
        const carve = (x, y) => {
          if (free(x, y)) {
            occupied.add(`${x},${y}`);
            waterCells.push({ x, y });
          }
        };
        if (biome.canFlood !== false) {
          const lx = ri(xMin + 1, Math.max(xMin + 1, Math.min(xMax - 4, xMin + 8)));
          const ly = ri(yMin + 1, Math.max(yMin + 1, Math.min(yMax - 3, yMin + 6)));
          for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 4; dx++) {
            if ((dx === 0 || dx === 3) && (dy === 0 || dy === 2)) continue;
            carve(lx + dx, ly + dy);
          }
          carve(lx + 1, ly - 1);
          carve(lx + 2, ly + 3);
          let rx = ri(Math.floor((xMin + xMax) / 2), xMax - 2), ry = yMin;
          carve(rx, ry);
          for (let i = 0, steps = ri(13, 18); i < steps && ry < yMax; i++) {
            if (rng() < 0.25 && rx > xMin + 1 && rx < xMax - 1) rx += rng() < 0.5 ? -1 : 1;
            else ry += 1;
            carve(rx, ry);
            if (rng() < 0.25) carve(Math.min(xMax, rx + 1), ry);
          }
        }
        const usable = d.objects.filter((o) => (o.biomes || []).includes(ar) && o.placement !== "indoor" && o.placement !== "none" && !o.isChest && !o.bridge);
        if (!usable.length) throw new GameError(t("server.err.noPlaceableObjects", { biome: biome.name }));
        const isPath = (o) => /-path$/.test(o.id) || o.id === "wooden-fence" || o.id === "dry-stone-wall";
        const trees = usable.filter((o) => o.plantable && (o.growSeconds || 0) >= 80);
        const flowers = usable.filter((o) => o.plantable && (o.growSeconds || 0) < 80);
        const NATURE = /* @__PURE__ */ new Set(["shrub", "rock-pile", "hollow-log", "log-shelter", "brush-pile", "stone-cairn", "rock-cairn", "clover-patch", "butterfly-flowers", "pollinator-garden", "fallen-branch-shelter", "insect-hotel", "birdhouse", "bird-perch"]);
        const nature = usable.filter((o) => !o.plantable && !isPath(o) && NATURE.has(o.id));
        const paths = usable.filter(isPath);
        const decor = usable.filter((o) => !o.plantable && !isPath(o) && !NATURE.has(o.id));
        const undergrowth = nature.length ? nature : flowers;
        const places = [];
        const place = (def, x, y) => {
          if (!def || !free(x, y)) return false;
          occupied.add(`${x},${y}`);
          const row = { id: `pl_dev_${ar}_${x}_${y}`, worldId: wid, playerId, objectId: def.id, area: ar, x, y, placedAt: OLD };
          if (def.plantable) row.plantedAt = OLD;
          places.push(row);
          return true;
        };
        const cluster = (pool, cx, cy, count, radius) => {
          if (!pool.length) return;
          const dom = rng() < 0.65 ? pick(pool) : null;
          for (let n = 0, tries = 0; n < count && tries < count * 8; tries++) {
            const def = dom && rng() < 0.7 ? dom : pick(pool);
            if (place(def, cx + ri(-radius, radius), cy + ri(-radius, radius))) n++;
          }
        };
        for (let i = 0, anchors = ri(8, 12); i < anchors; i++) {
          const cx = ri(xMin, xMax), cy = ri(yMin, yMax);
          const roll = rng();
          if (roll < 0.4 && flowers.length) cluster(flowers, cx, cy, ri(4, 8), 2);
          else if (roll < 0.72 && trees.length) {
            cluster(trees, cx, cy, ri(2, 4), 2);
            cluster(undergrowth, cx, cy, ri(1, 3), 2);
          } else cluster(undergrowth, cx, cy, ri(3, 6), 2);
        }
        if (paths.length) {
          for (let i = 0, runs = ri(1, 2); i < runs; i++) {
            const def = pick(paths);
            const horiz = rng() < 0.5;
            const len = ri(4, 6);
            const sx = ri(xMin, Math.max(xMin, xMax - (horiz ? len : 0)));
            const sy = ri(yMin, Math.max(yMin, yMax - (horiz ? 0 : len)));
            for (let k = 0; k < len; k++) place(def, sx + (horiz ? k : 0), sy + (horiz ? 0 : k));
          }
        }
        for (let n = 0, tries = 0, want = ri(14, 20); decor.length && n < want && tries < want * 12; tries++) {
          if (place(pick(decor), ri(xMin, xMax), ri(yMin, yMax))) n++;
        }
        for (let tries = 0; places.length < 34 && tries < 500; tries++) {
          place(pick(usable), ri(xMin, xMax), ri(yMin, yMax));
        }
        for (const w of waterCells) {
          await t2.TerrainTile.put({ id: `${wid}:${ar}:${w.x}:${w.y}`, worldId: wid, playerId, area: ar, x: w.x, y: w.y, type: "water", updatedAt: Date.now() });
        }
        for (const row of places) await t2.Placement.put(row);
        const waterTiles = waterCells.length;
        const placed = places.length;
        const here = d.animals.filter((a) => a.biome === ar);
        const already = new Set((await byWorld(t2.Discovery, wid)).filter((x) => x.biomeId === ar).map((x) => x.animalId));
        for (const animal of here) {
          if (already.has(animal.id)) continue;
          await t2.Discovery.put({
            id: `${wid}:${animal.id}`,
            worldId: wid,
            playerId,
            animalId: animal.id,
            biomeId: ar,
            comfort: 90,
            timesObserved: 0,
            firstObservedAt: Date.now(),
            whyReturned: whyReturnedText(animal, d)
          });
        }
        await recalcBiome(wid, playerId, ar, { player });
        const bs = await findBiomeState(t2.BiomeState, wid, ar);
        await t2.BiomeState.patch(bs?.id ?? `${wid}:${ar}`, { health: 100, balance: 100, returnedCount: here.length });
        for (const disc of (await byWorld(t2.Discovery, wid)).filter((x) => x.biomeId === ar)) {
          await t2.Discovery.patch(disc.id, { comfort: 90 });
        }
        log.push(`Populated ${biome.name}: ${placed} objects, ${waterTiles} water tiles, ${here.length} animals home, health 100`);
        break;
      }
      case "set-weather": {
        const v = value && typeof value === "object" ? value : null;
        if (!v || v.clear) {
          await t2.Player.patch(playerId, { devWeather: null });
          log.push("Weather override cleared \u2014 back to the live sky");
          break;
        }
        const cur = player.devWeather || {};
        const next = { type: cur.type ?? null, season: cur.season ?? null };
        if ("type" in v) {
          if (v.type && !WEATHER_TYPES.includes(v.type)) throw new GameError(t("server.err.unknownWeatherType", { type: v.type }));
          next.type = v.type || null;
        }
        if ("season" in v) {
          if (v.season && !SEASONS.includes(v.season)) throw new GameError(t("server.err.unknownSeason", { season: v.season }));
          next.season = v.season || null;
        }
        await t2.Player.patch(playerId, { devWeather: next });
        log.push(`Weather override: ${next.type || "live"} \xB7 ${next.season || "live"}`);
        break;
      }
      default:
        throw new GameError(t("server.err.unknownDevAction", { action }));
    }
    return { ok: true, log, state: await snapshot(playerId) };
  }
};
var FEEDBACK_MAX_CHARS = 4e3;
var SubmitFeedback = class extends PublicEndpoint {
  async post(data) {
    const body = await bodyOf(data);
    const message = String(body.message || "").trim();
    if (!message) throw new GameError(t("server.err.feedbackEmpty"));
    if (message.length > FEEDBACK_MAX_CHARS) throw new GameError(t("server.err.feedbackTooLong", { max: FEEDBACK_MAX_CHARS }));
    const replyTo = String(body.replyTo || "").trim().slice(0, 200) || null;
    if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) throw new GameError(t("server.err.feedbackBadEmail"));
    const metrics = body.metrics && typeof body.metrics === "object" && !Array.isArray(body.metrics) ? body.metrics : {};
    const queuedAt = Number(body.queuedAt) || null;
    const id = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await db().Feedback.put({ id, message, replyTo, metrics, queuedAt, createdAt: Date.now() });
    return { ok: true, id };
  }
};
var ListFeedback = class extends Resource {
  async get() {
    const rows = await allOf(db().Feedback);
    rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return { count: rows.length, feedback: rows };
  }
};
var METRICS_SNAPSHOT_MAX_BYTES = 24e3;
var SyncMetrics = class extends PublicEndpoint {
  async post(data) {
    const body = await bodyOf(data);
    const clientId = String(body.clientId || "").trim().slice(0, 64);
    if (!clientId) throw new GameError(t("server.err.clientIdRequired"));
    const snapshot2 = body.snapshot && typeof body.snapshot === "object" && !Array.isArray(body.snapshot) ? body.snapshot : null;
    if (!snapshot2) throw new GameError(t("server.err.snapshotRequired"));
    const snapshotJson = JSON.stringify(snapshot2);
    if (snapshotJson.length > METRICS_SNAPSHOT_MAX_BYTES) throw new GameError(t("server.err.snapshotTooLarge"));
    const t2 = db();
    const id = `solo:${clientId}`;
    const existing = await safeGet(t2.SoloMetrics, id);
    await t2.SoloMetrics.put({
      id,
      clientId,
      name: String(body.name || snapshot2.name || "").slice(0, 40),
      platform: String(body.platform || "").slice(0, 20) || null,
      // desktop | web
      os: String(body.os || "").slice(0, 20) || null,
      // mac | windows | linux | …
      version: String(body.version || "").slice(0, 24) || null,
      // wild-willows release
      build: String(body.build || "").slice(0, 40) || null,
      // build timestamp
      language: String(body.language || snapshot2.language || "").trim().toLowerCase().slice(0, 12) || null,
      // interface language
      snapshot: snapshotJson,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now()
    });
    dashboardCache = null;
    return { ok: true };
  }
};
var htmlPage = (html) => ({
  status: 200,
  headers: {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "public, max-age=3600"
  },
  body: html
});
var PrivacyPage = class extends PublicEndpoint {
  async get() {
    return htmlPage(privacyHtml);
  }
};
var AgeRatingPage = class extends PublicEndpoint {
  async get() {
    return htmlPage(ageRatingHtml);
  }
};
var SupportPage = class extends PublicEndpoint {
  async get() {
    return htmlPage(supportHtml);
  }
};
export {
  AppendFeed,
  BiomeSnapshot,
  ChangePasscode,
  CheckWorldCode,
  ChestTransfer,
  ClaimTask,
  CollectResource,
  CraftItem,
  CreatePlayer,
  CreateWorld,
  DeletePlayer,
  DevTools,
  DiscardItem,
  GameData,
  GameState,
  HarvestPlacement,
  Heartbeat,
  JoinRequestStatus,
  JoinWorld,
  LeaveWorld,
  ListFeedback,
  LoginPlayer,
  Metrics,
  MoveObject,
  MyWorlds,
  ObserveAnimal,
  PendingJoinRequests,
  PlaceObject,
  Plant,
  Presence,
  RecalcBiome,
  RemoveObject,
  RequestJoin,
  ResolveJoin,
  Rest,
  SetGoals,
  SetHomeColors,
  SetHomeStyle,
  SetPlacementColor,
  SubmitFeedback,
  SwitchWorld,
  SyncMetrics,
  SyncPlayer,
  Terraform,
  UpdateAppearance,
  UpgradeHome,
  UpgradeTool,
  Version,
  WorldRoster,
  AgeRatingPage as "age-rating",
  PrivacyPage as privacy,
  SupportPage as support
};
