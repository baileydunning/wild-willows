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
      restorationGoal: "Replant grasses and wildflowers, add water and shelter, and help 5 meadow animals return.",
      unlock: null,
      resources: [
        "seeds",
        "berries",
        "stones",
        "branches",
        "wildflowers",
        "fiber",
        "water",
        "clay",
        "bark"
      ],
      palette: {
        damaged: "#b9a37c",
        healthy: "#8fbf6f"
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
        minHealth: 80,
        minAnimals: 5,
        requiresItem: "meadow-restoration-kit",
        label: "Restore Willow Meadow to 80% health, welcome 5 meadow animals, and craft a Meadow Restoration Kit."
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
      palette: {
        damaged: "#9c8a66",
        healthy: "#5e9455"
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
        minHealth: 75,
        minAnimals: 10,
        requiresItem: "wetland-restoration-kit",
        label: "Restore Old Hollow Forest to 75% health, welcome 10 forest animals, and craft a Wetland Restoration Kit."
      },
      resources: [
        "reeds",
        "clay",
        "mud",
        "clean-water",
        "water",
        "fiber"
      ],
      palette: {
        damaged: "#a8a07a",
        healthy: "#6aa884"
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
        minAnimals: 5,
        minTotalAnimals: 30,
        requiresItem: "scrubland-restoration-kit",
        label: "Restore Rushwater Wetland to 80% health with 5 wetland animals back, welcome 30 animals across the whole preserve, and craft a Scrubland Restoration Kit."
      },
      resources: [
        "sand",
        "cactus-fruit",
        "stones",
        "clay",
        "geode",
        "agave-nectar"
      ],
      palette: {
        damaged: "#c78a52",
        healthy: "#e08a3c"
      },
      canFlood: false
    },
    {
      id: "alpine",
      name: "Graywind Heights",
      order: 5,
      explorable: false,
      description: "A trampled alpine slope. The wildflower turf is worn through and the talus is silent.",
      restorationGoal: "Restore alpine turf, snowmelt pools, and rocky shelter for high-country animals.",
      unlock: {
        biome: "desert",
        minHealth: 80,
        requiresItem: "alpine-restoration-kit",
        label: "Restore Redstone Scrubland to 80% health and craft an Alpine Restoration Kit."
      },
      resources: [
        "alpine-flowers",
        "stones",
        "moss",
        "clean-water"
      ],
      palette: {
        damaged: "#a8a8a0",
        healthy: "#9db98c"
      }
    },
    {
      id: "coastal",
      name: "Pelican Shore",
      order: 6,
      explorable: false,
      description: "A scoured stretch of coast. The dunes have washed out and the tidepools are empty.",
      restorationGoal: "Anchor the dunes, restore tidepools and kelp wrack, and reopen the shore to coastal life.",
      unlock: {
        biome: "alpine",
        minHealth: 80,
        requiresItem: "migration-path-marker",
        label: "Restore Graywind Heights to 80% health and craft a Migration Path Marker to restore the migration path."
      },
      resources: [
        "shells",
        "driftwood",
        "sand",
        "water"
      ],
      palette: {
        damaged: "#c2b9a0",
        healthy: "#e8d9a8"
      }
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
        seeds: 2,
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
        bark: 2
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
        bark: 3
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
      }
    },
    {
      id: "cozy-rug",
      name: "Picnic Rug",
      category: "home",
      unlockBiome: "meadow",
      output: {
        itemId: "cozy-rug",
        qty: 1
      },
      materials: {
        fiber: 6,
        wildflowers: 1
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
        stones: 3,
        clay: 4,
        fiber: 4,
        water: 6,
        moss: 2
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
        stones: 6,
        "alpine-flowers": 3,
        fiber: 2
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
      }
    },
    {
      id: "meadow-restoration-kit",
      name: "Meadow Restoration Kit",
      category: "kit",
      unlockBiome: "meadow",
      once: true,
      output: {
        itemId: "meadow-restoration-kit",
        qty: 1
      },
      materials: {
        fiber: 4,
        branches: 4,
        stones: 3,
        water: 2
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
        reeds: 5,
        mud: 4,
        clay: 3,
        "clean-water": 3
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
        sand: 5,
        stones: 5,
        clay: 3,
        "cactus-fruit": 2
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
      }
    },
    {
      id: "daisy-patch",
      name: "Daisy Patch",
      category: "plant",
      unlockBiome: "meadow",
      output: {
        itemId: "daisy-patch",
        qty: 1
      },
      materials: {
        seeds: 2,
        fiber: 1
      }
    },
    {
      id: "foxglove",
      name: "Foxglove",
      category: "plant",
      unlockBiome: "meadow",
      output: {
        itemId: "foxglove",
        qty: 1
      },
      materials: {
        seeds: 2,
        wildflowers: 2
      }
    },
    {
      id: "mushroom-ring",
      name: "Mushroom Ring",
      category: "plant",
      unlockBiome: "forest",
      output: {
        itemId: "mushroom-ring",
        qty: 1
      },
      materials: {
        mushrooms: 3,
        moss: 1
      }
    },
    {
      id: "birch-tree",
      name: "Birch Tree",
      category: "plant",
      unlockBiome: "forest",
      output: {
        itemId: "birch-tree",
        qty: 1
      },
      materials: {
        branches: 4,
        bark: 2
      }
    },
    {
      id: "marsh-marigold",
      name: "Marsh Marigold",
      category: "plant",
      unlockBiome: "wetland",
      output: {
        itemId: "marsh-marigold",
        qty: 1
      },
      materials: {
        reeds: 2,
        seeds: 1
      }
    },
    {
      id: "bulrush",
      name: "Bulrush",
      category: "plant",
      unlockBiome: "wetland",
      output: {
        itemId: "bulrush",
        qty: 1
      },
      materials: {
        reeds: 4,
        mud: 1
      }
    },
    {
      id: "prickly-pear",
      name: "Prickly Pear",
      category: "plant",
      unlockBiome: "desert",
      output: {
        itemId: "prickly-pear",
        qty: 1
      },
      materials: {
        "cactus-fruit": 3,
        sand: 1
      }
    },
    {
      id: "desert-marigold",
      name: "Desert Marigold",
      category: "plant",
      unlockBiome: "desert",
      output: {
        itemId: "desert-marigold",
        qty: 1
      },
      materials: {
        sand: 2,
        seeds: 1
      }
    },
    {
      id: "gentian-patch",
      name: "Alpine Gentian",
      category: "plant",
      unlockBiome: "alpine",
      output: {
        itemId: "gentian-patch",
        qty: 1
      },
      materials: {
        "alpine-flowers": 3
      }
    },
    {
      id: "moss-cushion",
      name: "Moss Cushion",
      category: "plant",
      unlockBiome: "alpine",
      output: {
        itemId: "moss-cushion",
        qty: 1
      },
      materials: {
        moss: 3
      }
    },
    {
      id: "sea-thrift",
      name: "Sea Thrift",
      category: "plant",
      unlockBiome: "coastal",
      output: {
        itemId: "sea-thrift",
        qty: 1
      },
      materials: {
        sand: 2,
        seeds: 1
      }
    },
    {
      id: "beach-shrub",
      name: "Beach Shrub",
      category: "plant",
      unlockBiome: "coastal",
      output: {
        itemId: "beach-shrub",
        qty: 1
      },
      materials: {
        driftwood: 2,
        sand: 1
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
      }
    },
    {
      id: "palo-verde-tree",
      name: "Palo Verde Tree",
      category: "plant",
      unlockBiome: "desert",
      output: {
        itemId: "palo-verde-tree",
        qty: 1
      },
      materials: {
        seeds: 2,
        sand: 2
      }
    },
    {
      id: "shore-pine",
      name: "Shore Pine",
      category: "plant",
      unlockBiome: "coastal",
      output: {
        itemId: "shore-pine",
        qty: 1
      },
      materials: {
        seeds: 2,
        sand: 2
      }
    },
    {
      id: "bald-cypress",
      name: "Bald Cypress",
      category: "plant",
      unlockBiome: "wetland",
      output: {
        itemId: "bald-cypress",
        qty: 1
      },
      materials: {
        seeds: 2,
        reeds: 1
      }
    },
    {
      id: "water-tupelo",
      name: "Water Tupelo",
      category: "plant",
      unlockBiome: "wetland",
      output: {
        itemId: "water-tupelo",
        qty: 1
      },
      materials: {
        seeds: 2,
        mud: 1
      }
    },
    {
      id: "mesquite-tree",
      name: "Mesquite",
      category: "plant",
      unlockBiome: "desert",
      output: {
        itemId: "mesquite-tree",
        qty: 1
      },
      materials: {
        seeds: 2,
        sand: 1
      }
    },
    {
      id: "desert-ironwood",
      name: "Desert Ironwood",
      category: "plant",
      unlockBiome: "desert",
      output: {
        itemId: "desert-ironwood",
        qty: 1
      },
      materials: {
        seeds: 2,
        sand: 1
      }
    },
    {
      id: "subalpine-fir",
      name: "Subalpine Fir",
      category: "plant",
      unlockBiome: "alpine",
      output: {
        itemId: "subalpine-fir",
        qty: 1
      },
      materials: {
        seeds: 2
      }
    },
    {
      id: "quaking-aspen",
      name: "Quaking Aspen",
      category: "plant",
      unlockBiome: "alpine",
      output: {
        itemId: "quaking-aspen",
        qty: 1
      },
      materials: {
        seeds: 2
      }
    },
    {
      id: "monterey-cypress",
      name: "Monterey Cypress",
      category: "plant",
      unlockBiome: "coastal",
      output: {
        itemId: "monterey-cypress",
        qty: 1
      },
      materials: {
        seeds: 2,
        sand: 1
      }
    },
    {
      id: "coast-live-oak",
      name: "Coast Live Oak",
      category: "plant",
      unlockBiome: "coastal",
      output: {
        itemId: "coast-live-oak",
        qty: 1
      },
      materials: {
        seeds: 2
      }
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
      description: "A soft patch of regrowing grass. A first step for any bare ground."
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
      description: "Deep-rooted native bunchgrass. Food and cover for meadow life."
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
      description: "Mixed native wildflowers. Pollinators can spot it from far away."
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
      description: "Bright field poppies, grown from seed in a watered bed."
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
      description: "Tall sunflowers that feed seed-eating birds all season."
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
      description: "Spires of blue lupine that fix the soil as they bloom."
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
      description: "The preserve's namesake \u2014 a graceful willow grown from a watered bed."
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
      description: "An acorn-grown oak. Squirrels and jays will thank you for decades."
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
      description: "A young pine grown from a cone \u2014 evergreen shelter in any season."
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
      description: "Milkweed and nectar flowers, planted especially for butterflies."
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
      description: "A dense, season-long banquet for bees and butterflies."
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
      description: "A young native shrub. Quick cover for anyone passing through."
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
      description: "A thornless native berry bush. Songbirds, rabbits, deer, and bears all visit. Sow it in a watered bed from seeds and a few berries."
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
      description: "A fast-growing native tree planted for squirrels, owls, and nuthatches."
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
      growSeconds: 45
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
      growSeconds: 45
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
      growSeconds: 70
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
      growSeconds: 50
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
      growSeconds: 45
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
      growSeconds: 45
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
      description: "A protected line of washed-up kelp \u2014 a buffet for the whole beach."
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
      chestCapacity: 60,
      description: "A woven-and-wood chest. Holds 60 materials. Place it near your workbench to link it."
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
      chestCapacity: 120,
      description: "A sturdier chest. Holds 120 materials."
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
      id: "cozy-rug",
      name: "Picnic Rug",
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
      shape: "rug",
      color: "#b5707a",
      description: "A hand-woven rug for resting beside your work. Purely cozy."
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
      id: "meadow-restoration-kit",
      name: "Meadow Restoration Kit",
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
      shape: "lantern",
      color: "#caa15a",
      description: "A little stone lantern with a warm glow to light the path."
    },
    {
      id: "wooden-bench",
      name: "Wooden Bench",
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
      shape: "signpost",
      color: "#a3814f",
      description: "A hand-painted signpost to guide visitors through the preserve."
    },
    {
      id: "planter-box",
      name: "Planter Box",
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
      description: "Low clover and trefoil \u2014 nectar for bees and forage for rabbits."
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
      growSeconds: 50
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
      growSeconds: 45
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
      growSeconds: 60
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
      growSeconds: 60
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
      growSeconds: 50
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
      description: "A wind-sculpted dwarf pine \u2014 rare shelter at the tree line."
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
      growSeconds: 45
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
      description: "Cheerful oxeye daisies that open with the morning sun."
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
      description: "Tall pink foxglove spires \u2014 a bumblebee favourite."
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
      description: "A fairy ring of woodland mushrooms in the leaf litter."
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
      description: "A slender white-barked birch grown from a watered bed."
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
      description: "Golden marsh marigolds that ring the shallows in spring."
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
      description: "Stately bulrushes with brown velvet heads along the bank."
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
      description: "Pad cactus with sweet fruit and bright blooms."
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
      description: "Drought-tough marigolds that glow against the sand."
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
      description: "Vivid blue alpine gentians, low against the wind."
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
      description: "A springy cushion of moss dotted with tiny blooms."
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
      description: "Pink sea-thrift pompoms that thrive in salt spray."
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
      description: "A salt-hardy grey-green coastal shrub."
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
      placement: "both",
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
      placement: "both",
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
      description: "The green-barked desert tree \u2014 rare shade and yellow blooms for the scrubland."
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
      description: "A salt-bent pine that anchors the back dunes and shelters shorebirds."
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
      description: "A towering swamp cypress with feathery needles and a flared, knee-rooted base."
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
      description: "A round-crowned wetland tree whose swollen base stands right in the water."
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
      description: "A low, spreading desert tree \u2014 airy shade and seed pods for the scrubland."
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
      description: "A dense, slow-growing ironwood \u2014 a vital nurse tree in the open desert."
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
      description: "A slender spire fir that shrugs off the high-country snow."
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
      description: "White-barked aspen whose golden leaves shiver in the alpine wind."
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
      description: "A wind-flattened coastal cypress sculpted by the sea breeze."
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
      description: "A broad evergreen oak that anchors the back shore with deep shade."
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
        { tier: 1, name: "Gathering Basket", effect: "Carry up to 80 materials and gather 1 at a time." },
        {
          tier: 2,
          name: "Reinforced Gathering Basket",
          effect: "Carry up to 160 materials and gather 2 light materials at a time.",
          materials: { fiber: 8, branches: 4, bark: 2 },
          requires: { biome: "meadow", minHealth: 40 }
        },
        {
          tier: 3,
          name: "Woven Carryall",
          effect: "Carry up to 260 materials and gather 3 at a time.",
          materials: { fiber: 10, bark: 4, moss: 4 },
          requires: { biome: "forest", minHealth: 60 }
        },
        {
          tier: 4,
          name: "Naturalist's Pack",
          effect: "Carry up to 380 materials and gather 4 at a time.",
          materials: { reeds: 8, fiber: 8, clay: 4 },
          requires: { biome: "wetland", minHealth: 65 }
        }
      ]
    },
    {
      id: "shovel",
      name: "Basic Shovel",
      description: "For carefully digging stones, clay, and sand, and preparing restoration ground.",
      tiers: [
        { tier: 1, name: "Basic Shovel", effect: "Dig stones, clay, and sand; gather 1 at a time." },
        {
          tier: 2,
          name: "Restoration Shovel",
          effect: "Shape wetland mud banks and burrow mounds; gather 2 dug materials.",
          materials: { branches: 4, stones: 6, fiber: 2 },
          requires: { biome: "meadow", minHealth: 30 }
        },
        {
          tier: 3,
          name: "Tempered Spade",
          effect: "Dig faster and gather 3 dug materials at a time.",
          materials: { stones: 8, bark: 3, clay: 4 },
          requires: { biome: "forest", minHealth: 55 }
        },
        {
          tier: 4,
          name: "Earthshaper's Spade",
          effect: "Shape the toughest ground and gather 4 dug materials at a time.",
          materials: { stones: 10, clay: 6, reeds: 4 },
          requires: { biome: "wetland", minHealth: 65 }
        }
      ]
    },
    {
      id: "watering-can",
      name: "Tin Watering Can",
      description: "For carrying water to thirsty ground and new plantings.",
      tiers: [
        { tier: 1, name: "Tin Watering Can", effect: "Collect 1 water from springs and streams." },
        {
          tier: 2,
          name: "Rainwater Canteen",
          effect: "Collect 2 water at a time \u2014 restore dry ground more efficiently.",
          materials: { clay: 6, fiber: 3, water: 4 },
          requires: { biome: "meadow", minHealth: 30 }
        },
        {
          tier: 3,
          name: "Spring-fed Ewer",
          effect: "Collect 3 water at a time for rivers, lakes, and lush beds.",
          materials: { clay: 8, bark: 4, water: 6 },
          requires: { biome: "forest", minHealth: 55 }
        },
        {
          tier: 4,
          name: "Cloudcatcher Urn",
          effect: "Collect 4 water at a time \u2014 flood whole channels in a few trips.",
          materials: { clay: 10, "clean-water": 6, stones: 4 },
          requires: { biome: "wetland", minHealth: 65 }
        }
      ]
    },
    {
      id: "field-journal",
      name: "Field Journal",
      description: "For observing animals and recording who has returned. Each upgrade unlocks the full field entries and return hints for the next area.",
      tiers: [
        { tier: 1, name: "Field Journal", effect: "Read full entries and hints for Willow Meadow animals." },
        {
          tier: 2,
          name: "Expanded Field Guide",
          effect: "Read full entries and hints for Old Hollow Forest animals.",
          materials: { bark: 4, fiber: 4, berries: 2 },
          requires: { biome: "meadow", minHealth: 50 }
        },
        {
          tier: 3,
          name: "Wetland Field Guide",
          effect: "Read full entries and hints for Rushwater Wetland animals.",
          materials: { moss: 4, bark: 3, mushrooms: 2 },
          requires: { biome: "forest", minHealth: 55 }
        },
        {
          tier: 4,
          name: "Drylands Field Guide",
          effect: "Read full entries and hints for Redstone Scrubland animals.",
          materials: { reeds: 4, clay: 3, mud: 2 },
          requires: { biome: "wetland", minHealth: 60 }
        },
        {
          tier: 5,
          name: "Highlands Field Guide",
          effect: "Read full entries and hints for Graywind Heights animals.",
          materials: { sand: 4, "cactus-fruit": 2, clay: 2 },
          requires: { biome: "desert", minHealth: 60 }
        },
        {
          tier: 6,
          name: "Master Naturalist's Guide",
          effect: "Read full entries and hints for Pelican Shore animals \u2014 the complete field guide.",
          materials: { "alpine-flowers": 3, moss: 2, stones: 3 },
          requires: { biome: "alpine", minHealth: 60 }
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
      diet: "Grasses, clover, and berries",
      shelter: "Shrub cover and brush piles",
      preferredHabitat: "Open grass with shrubby edges to dart into",
      fact: "Cottontails rest in shallow ground depressions called 'forms' rather than digging their own burrows.",
      requirements: {
        minHealth: 25,
        objects: {
          "native-grass-patch": 1,
          "berry-bush": 1,
          shrub: 1
        },
        hint: "Plant native grass and a berry bush, with shrub cover close by."
      }
    },
    {
      id: "monarch-butterfly",
      name: "Monarch Butterfly",
      biome: "meadow",
      kind: "insect",
      rarity: "common",
      featured: true,
      diet: "Flower nectar; caterpillars eat only milkweed",
      shelter: "Flower patches and sheltering plants",
      preferredHabitat: "Sunny flower patches with milkweed",
      fact: "Monarchs migrate up to 3,000 miles, and no single butterfly makes the whole round trip.",
      requirements: {
        minHealth: 15,
        objects: {
          "wildflower-patch": 1,
          "butterfly-flowers": 1
        },
        hint: "Wildflowers plus dedicated butterfly flowers with milkweed."
      }
    },
    {
      id: "song-sparrow",
      name: "Song Sparrow",
      biome: "meadow",
      kind: "bird",
      rarity: "common",
      featured: true,
      diet: "Seeds and small insects",
      shelter: "Low shrubs and grass tussocks",
      preferredHabitat: "Brushy edges with singing perches",
      fact: "A single song sparrow may know as many as 20 different song variations.",
      requirements: {
        minHealth: 20,
        objects: {
          shrub: 1,
          "native-grass-patch": 1,
          "bird-perch": 1
        },
        hint: "Shrubs, native grass, and somewhere high to sing from."
      }
    },
    {
      id: "mule-deer",
      name: "Mule Deer",
      biome: "meadow",
      kind: "mammal",
      rarity: "uncommon",
      featured: true,
      diet: "Grasses, shrubs, and tender shoots",
      shelter: "Shrub thickets at the meadow edge",
      preferredHabitat: "Healthy open meadow with browse and water",
      fact: "Mule deer are named for their oversized ears, which move independently like a mule's.",
      requirements: {
        minHealth: 55,
        objects: {
          shrub: 2,
          "native-grass-patch": 2,
          "small-pond": 1
        },
        hint: "A healthier meadow with plenty of browse and a pond to drink from."
      }
    },
    {
      id: "red-fox-meadow",
      name: "Red Fox",
      biome: "meadow",
      kind: "mammal",
      rarity: "rare",
      featured: true,
      diet: "Voles, rabbits, insects, and berries",
      shelter: "Hollow logs and dense shrub cover",
      preferredHabitat: "A thriving meadow with plenty of small animals",
      fact: "Red foxes use Earth's magnetic field to help judge their famous high pounce on hidden prey.",
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
      }
    },
    {
      id: "meadow-vole",
      name: "Meadow Vole",
      biome: "meadow",
      kind: "mammal",
      rarity: "common",
      diet: "Grass stems, seeds, and roots",
      shelter: "Runways under dense grass",
      preferredHabitat: "Thick grass with hidden runways",
      fact: "Meadow voles cut tiny tunnels through grass called runways, which feed half the food web.",
      requirements: {
        minHealth: 15,
        objects: {
          "grass-patch": 1,
          "native-grass-patch": 1
        },
        hint: "Any thick grass cover will do \u2014 voles arrive early."
      }
    },
    {
      id: "ground-squirrel",
      name: "Ground Squirrel",
      biome: "meadow",
      kind: "mammal",
      rarity: "common",
      diet: "Seeds, grasses, and flowers",
      shelter: "Burrows near rock cover",
      preferredHabitat: "Open grass near rocky lookout points",
      fact: "Ground squirrels kick sand at rattlesnakes and wave their heated tails to confuse them.",
      requirements: {
        minHealth: 25,
        objects: {
          "rock-pile": 1,
          "native-grass-patch": 1
        },
        hint: "Grass to eat and rocks to keep watch from."
      }
    },
    {
      id: "garter-snake-meadow",
      name: "Garter Snake",
      biome: "meadow",
      kind: "reptile",
      rarity: "uncommon",
      diet: "Worms, insects, and small rodents",
      shelter: "Rock piles and grass cover",
      preferredHabitat: "Sunny rocks beside hunting grass",
      fact: "Garter snakes are mildly venomous to their tiny prey but completely harmless to people.",
      requirements: {
        minHealth: 40,
        objects: {
          "rock-pile": 1,
          "grass-patch": 1,
          shrub: 1
        },
        animals: [
          "meadow-vole"
        ],
        hint: "Warm rocks, grass to hunt in, and small prey already about."
      }
    },
    {
      id: "bumblebee",
      name: "Bumblebee",
      biome: "meadow",
      kind: "insect",
      rarity: "common",
      diet: "Nectar and pollen",
      shelter: "Old burrows and grass tussocks",
      preferredHabitat: "Flower-rich meadow",
      fact: "Bumblebees 'buzz pollinate' \u2014 vibrating flowers at just the right frequency to shake pollen loose.",
      requirements: {
        minHealth: 25,
        objects: {
          "wildflower-patch": 1,
          "pollinator-garden": 1,
          shrub: 1
        },
        hint: "The more kinds of flowers, the better."
      }
    },
    {
      id: "grasshopper",
      name: "Grasshopper",
      biome: "meadow",
      kind: "insect",
      rarity: "common",
      diet: "Grasses and leafy plants",
      shelter: "Tall grass",
      preferredHabitat: "Any recovering grassland",
      fact: "Grasshoppers hear through tiny membranes on their abdomen, not their heads.",
      requirements: {
        minHealth: 10,
        objects: {
          "grass-patch": 1
        },
        hint: "Grasshoppers return almost as soon as the grass does."
      }
    },
    {
      id: "lady-beetle",
      name: "Lady Beetle",
      biome: "meadow",
      kind: "insect",
      rarity: "common",
      diet: "Aphids and other tiny insects",
      shelter: "Flower stems and leaf litter",
      preferredHabitat: "Flower patches with plenty of aphids",
      fact: "A single lady beetle can eat 5,000 aphids over its lifetime \u2014 a gardener's best friend.",
      requirements: {
        minHealth: 12,
        objects: {
          "wildflower-patch": 1
        },
        hint: "Flowers bring aphids, and aphids bring lady beetles."
      }
    },
    {
      id: "western-meadowlark",
      name: "Western Meadowlark",
      biome: "meadow",
      kind: "bird",
      rarity: "uncommon",
      diet: "Insects, grain, and weed seeds",
      shelter: "Ground nests woven into thick grass",
      preferredHabitat: "Wide native grassland with song perches",
      fact: "The western meadowlark's flute-like song is the state bird anthem of six U.S. states.",
      requirements: {
        minHealth: 45,
        objects: {
          "native-grass-patch": 2,
          "bird-perch": 1,
          shrub: 1
        },
        hint: "Meadowlarks need real expanses of native grass before they will nest."
      }
    },
    {
      id: "barn-swallow",
      name: "Barn Swallow",
      biome: "meadow",
      kind: "bird",
      rarity: "uncommon",
      diet: "Flying insects caught on the wing",
      shelter: "Mud nests on sheltered ledges",
      preferredHabitat: "Open air above water and flowers",
      fact: "Barn swallows build their cup nests from up to 1,000 individual beakfuls of mud.",
      requirements: {
        minHealth: 40,
        objects: {
          "small-pond": 1,
          "bird-perch": 1,
          shrub: 1
        },
        hint: "A pond for mud and insects, and a perch to rest between flights."
      }
    },
    {
      id: "red-tailed-hawk",
      name: "Red-tailed Hawk",
      biome: "meadow",
      kind: "bird",
      rarity: "rare",
      diet: "Voles, squirrels, and other small animals",
      shelter: "Tall perches overlooking open ground",
      preferredHabitat: "A full, busy meadow seen from above",
      fact: "That piercing 'eagle' cry in the movies is almost always actually a red-tailed hawk.",
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
        hint: "Hawks watch for a meadow already full of small animals."
      }
    },
    {
      id: "barn-owl",
      name: "Barn Owl",
      biome: "meadow",
      kind: "bird",
      rarity: "rare",
      diet: "Voles and mice, hunted at night",
      shelter: "Dark cavities and quiet structures",
      preferredHabitat: "Quiet meadow nights with rustling grass",
      fact: "A barn owl can strike prey in total darkness, guided by ears set at different heights.",
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
        hint: "A quiet, healthy meadow with plenty of voles and a dark place to roost."
      }
    },
    {
      id: "tree-squirrel",
      name: "Tree Squirrel",
      biome: "forest",
      kind: "mammal",
      rarity: "common",
      featured: true,
      diet: "Acorns, pinecones, seeds, and fungi",
      shelter: "Tree hollows and leafy dreys",
      preferredHabitat: "Trees with fallen logs and seed caches below",
      fact: "Squirrels forget some of their buried caches every year \u2014 and those lost seeds become new trees.",
      requirements: {
        minHealth: 20,
        objects: {
          "nesting-tree": 1,
          "log-shelter": 1
        },
        hint: "A nesting tree and fallen logs with seeds to cache."
      }
    },
    {
      id: "woodpecker",
      name: "Woodpecker",
      biome: "forest",
      kind: "bird",
      rarity: "common",
      featured: true,
      diet: "Beetle larvae and insects under bark",
      shelter: "Cavities drilled into standing deadwood",
      preferredHabitat: "Standing dead snags full of insects",
      fact: "Woodpeckers wrap their long tongues around the back of their skull as built-in shock absorbers.",
      requirements: {
        minHealth: 25,
        objects: {
          "standing-deadwood": 1
        },
        hint: "Woodpeckers need standing deadwood \u2014 keep some snags up."
      }
    },
    {
      id: "forest-salamander",
      name: "Forest Salamander",
      biome: "forest",
      kind: "amphibian",
      rarity: "uncommon",
      featured: true,
      diet: "Tiny insects and invertebrates",
      shelter: "Damp logs and cool leaf litter",
      preferredHabitat: "Shaded, damp logs near clean water",
      fact: "Many forest salamanders have no lungs at all \u2014 they breathe entirely through their moist skin.",
      requirements: {
        minHealth: 40,
        objects: {
          "mushroom-log": 1,
          "shallow-water-pool": 1,
          shrub: 1
        },
        hint: "Damp shaded logs and clean shallow water."
      }
    },
    {
      id: "great-horned-owl",
      name: "Great Horned Owl",
      biome: "forest",
      kind: "bird",
      rarity: "rare",
      featured: true,
      diet: "Squirrels, rabbits, and other small animals",
      shelter: "Tall trees with quiet, hidden roosts",
      preferredHabitat: "Mature quiet forest with plentiful prey",
      fact: "A great horned owl's grip is strong enough that it can carry prey heavier than itself.",
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
      }
    },
    {
      id: "black-bear",
      name: "Black Bear",
      biome: "forest",
      kind: "mammal",
      rarity: "rare",
      featured: true,
      diet: "Berries, nuts, insects, and fish",
      shelter: "Dense cover and sheltered dens",
      preferredHabitat: "A deeply restored forest with abundant food",
      fact: "Black bears can smell food from over a mile away \u2014 the best nose in the forest.",
      requirements: {
        minHealth: 75,
        minBalance: 50,
        objects: {
          "berry-bush": 3,
          "small-pond": 1,
          "log-shelter": 1
        },
        hint: "Bears return only to a richly restored forest: lots of berries, water, shelter, and space."
      }
    },
    {
      id: "red-fox-forest",
      name: "Red Fox",
      biome: "forest",
      kind: "mammal",
      rarity: "uncommon",
      diet: "Small mammals, insects, and fruit",
      shelter: "Hollow logs and root dens",
      preferredHabitat: "Forest edges with denning cover",
      fact: "Fox pairs often reuse and expand the same den site for generations.",
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
      }
    },
    {
      id: "mule-deer-forest",
      name: "Mule Deer",
      biome: "forest",
      kind: "mammal",
      rarity: "uncommon",
      diet: "Shrubs, twigs, and forest browse",
      shelter: "Thickets and shaded bedding spots",
      preferredHabitat: "Forest openings with browse and water",
      fact: "Mule deer bound in a four-footed pogo gait called 'stotting' to clear obstacles downhill.",
      requirements: {
        minHealth: 55,
        objects: {
          shrub: 2,
          "small-pond": 1,
          "fern-grove": 1
        },
        hint: "Shrubby browse and a quiet pond."
      }
    },
    {
      id: "elk-forest",
      name: "Elk",
      biome: "forest",
      kind: "mammal",
      rarity: "rare",
      diet: "Grasses and forest forage",
      shelter: "Forest meadows and timber edges",
      preferredHabitat: "Grassy clearings inside recovering forest",
      fact: "A bull elk's bugle can carry for miles \u2014 one of the loudest calls of any land mammal in North America.",
      requirements: {
        minHealth: 70,
        objects: {
          "grass-patch": 2,
          "small-pond": 1,
          shrub: 1
        },
        hint: "Grassy clearings and water in a healthy forest."
      }
    },
    {
      id: "raccoon",
      name: "Raccoon",
      biome: "forest",
      kind: "mammal",
      rarity: "common",
      diet: "Almost anything: fruit, insects, crayfish",
      shelter: "Hollow logs and tree cavities",
      preferredHabitat: "Woods near water for washing and foraging",
      fact: "A raccoon's front paws have four times more touch receptors than its eyes have light receptors.",
      requirements: {
        minHealth: 45,
        objects: {
          "hollow-log": 1,
          "small-pond": 1,
          shrub: 1
        },
        hint: "A den log near water to dabble in."
      }
    },
    {
      id: "porcupine",
      name: "Porcupine",
      biome: "forest",
      kind: "mammal",
      rarity: "uncommon",
      diet: "Bark, twigs, and spring buds",
      shelter: "Rock dens and hollow trees",
      preferredHabitat: "Quiet woods with bark to nibble",
      fact: "Porcupine quills have microscopic backward barbs but also a mild antibiotic coating \u2014 protection against their own clumsy falls.",
      requirements: {
        minHealth: 50,
        objects: {
          "nesting-tree": 1,
          "fallen-branch-shelter": 1,
          shrub: 1
        },
        hint: "Trees to climb and brushy shelter below."
      }
    },
    {
      id: "bobcat",
      name: "Bobcat",
      biome: "forest",
      kind: "mammal",
      rarity: "rare",
      diet: "Rabbits, squirrels, and birds",
      shelter: "Rock ledges and dense thickets",
      preferredHabitat: "A quiet, prey-rich forest",
      fact: "Bobcats are named for their short 'bobbed' tails and can leap ten feet in a single pounce.",
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
        hint: "Bobcats follow plentiful prey and need rocky, brushy cover."
      }
    },
    {
      id: "chipmunk",
      name: "Chipmunk",
      biome: "forest",
      kind: "mammal",
      rarity: "common",
      diet: "Seeds, nuts, and berries",
      shelter: "Burrows under rocks and logs",
      preferredHabitat: "Forest floor with rocky hideouts",
      fact: "A chipmunk's cheek pouches can stretch to three times the size of its head.",
      requirements: {
        minHealth: 20,
        objects: {
          "rock-pile": 1,
          "fallen-branch-shelter": 1
        },
        hint: "Rocky cover and brush piles on the forest floor."
      }
    },
    {
      id: "nuthatch",
      name: "Nuthatch",
      biome: "forest",
      kind: "bird",
      rarity: "common",
      diet: "Insects and seeds wedged into bark",
      shelter: "Tree cavities",
      preferredHabitat: "Trees with rough bark to forage down",
      fact: "Nuthatches are the only birds that routinely walk headfirst down tree trunks.",
      requirements: {
        minHealth: 40,
        objects: {
          "nesting-tree": 1,
          "standing-deadwood": 1,
          shrub: 1
        },
        hint: "Live trees to forage and deadwood to nest in."
      }
    },
    {
      id: "garter-snake-forest",
      name: "Garter Snake",
      biome: "forest",
      kind: "reptile",
      rarity: "uncommon",
      diet: "Worms, amphibians, and small rodents",
      shelter: "Sun-warmed rocks near cover",
      preferredHabitat: "Sunny forest openings with rocks",
      fact: "Garter snakes gather in large groups to hibernate through cold winters, sharing body heat.",
      requirements: {
        minHealth: 45,
        objects: {
          "rock-pile": 1,
          "grass-patch": 1,
          shrub: 1
        },
        hint: "A sunny rock pile beside grassy hunting ground."
      }
    },
    {
      id: "banana-slug",
      name: "Banana Slug",
      biome: "forest",
      kind: "invertebrate",
      rarity: "common",
      diet: "Leaves, fungi, and forest debris",
      shelter: "Damp logs and moss",
      preferredHabitat: "Cool, damp forest floor",
      fact: "Banana slugs are champion recyclers, turning fallen leaves into rich soil as they go.",
      requirements: {
        minHealth: 35,
        objects: {
          "mushroom-log": 1,
          "shallow-water-pool": 1,
          shrub: 1
        },
        hint: "Keep the forest floor damp, mossy, and full of logs."
      }
    },
    {
      id: "beaver",
      name: "Beaver",
      biome: "wetland",
      kind: "mammal",
      rarity: "rare",
      featured: true,
      diet: "Bark, twigs, and aquatic plants",
      shelter: "Lodges built of mud and branches",
      preferredHabitat: "Channels with mud banks and woody food",
      fact: "Beavers are ecosystem engineers \u2014 their dams create wetlands that support hundreds of other species.",
      requirements: {
        minHealth: 70,
        objects: {
          "shallow-water-pool": 2,
          "mud-bank": 1,
          "reed-bed": 1
        },
        hint: "Restored water channels, mud banks, and woody plants."
      }
    },
    {
      id: "river-otter",
      name: "River Otter",
      biome: "wetland",
      kind: "mammal",
      rarity: "rare",
      featured: true,
      diet: "Fish, crayfish, and frogs",
      shelter: "Bank dens with underwater entrances",
      preferredHabitat: "Clean water busy with fish",
      fact: "River otters slide down mudbanks on their bellies \u2014 sometimes purely, as far as anyone can tell, for fun.",
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
      }
    },
    {
      id: "muskrat",
      name: "Muskrat",
      biome: "wetland",
      kind: "mammal",
      rarity: "common",
      diet: "Cattails, reeds, and roots",
      shelter: "Dome lodges woven from reeds",
      preferredHabitat: "Reedy shallows",
      fact: "Muskrats can stay underwater for up to 15 minutes on a single breath.",
      requirements: {
        minHealth: 40,
        objects: {
          "reed-bed": 1,
          "shallow-water-pool": 1,
          "sedge-tussock": 1
        },
        hint: "Reeds to eat and build with, water to swim."
      }
    },
    {
      id: "mink",
      name: "Mink",
      biome: "wetland",
      kind: "mammal",
      rarity: "rare",
      diet: "Fish, frogs, and small mammals",
      shelter: "Bank burrows near water",
      preferredHabitat: "Brushy banks beside busy water",
      fact: "Mink are strong swimmers that can dive over 15 feet deep when hunting.",
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
      }
    },
    {
      id: "great-blue-heron",
      name: "Great Blue Heron",
      biome: "wetland",
      kind: "bird",
      rarity: "uncommon",
      featured: true,
      diet: "Fish, frogs, and small aquatic animals",
      shelter: "Quiet, raised nesting platforms",
      preferredHabitat: "Still shallows for slow, patient hunting",
      fact: "Herons strike faster than the eye can follow, but may stand motionless for an hour first.",
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
      }
    },
    {
      id: "mallard-duck",
      name: "Mallard Duck",
      biome: "wetland",
      kind: "bird",
      rarity: "common",
      diet: "Seeds, aquatic plants, and insects",
      shelter: "Reedy water edges",
      preferredHabitat: "Calm pools with cover",
      fact: "Mallards can sleep with one eye open, resting one half of their brain at a time.",
      requirements: {
        minHealth: 25,
        objects: {
          "shallow-water-pool": 1,
          "reed-bed": 1
        },
        hint: "Calm shallow water with reed cover."
      }
    },
    {
      id: "red-winged-blackbird",
      name: "Red-winged Blackbird",
      biome: "wetland",
      kind: "bird",
      rarity: "common",
      diet: "Insects and seeds",
      shelter: "Nests woven into standing reeds",
      preferredHabitat: "Dense reed beds",
      fact: "Male red-winged blackbirds may defend territories holding a dozen nests at once.",
      requirements: {
        minHealth: 25,
        objects: {
          "reed-bed": 2
        },
        hint: "The thicker the reeds, the better."
      }
    },
    {
      id: "sandhill-crane",
      name: "Sandhill Crane",
      biome: "wetland",
      kind: "bird",
      rarity: "rare",
      diet: "Grains, tubers, insects, and small animals",
      shelter: "Open marsh with wide sightlines",
      preferredHabitat: "Broad, quiet, restored marshland",
      fact: "Sandhill cranes dance \u2014 leaping, bowing, and tossing grass \u2014 at any age, not just to court.",
      requirements: {
        minHealth: 75,
        minBalance: 45,
        objects: {
          "shallow-water-pool": 2,
          "reed-bed": 2,
          "sedge-tussock": 1
        },
        hint: "Cranes need a wide, quiet, well-balanced marsh."
      }
    },
    {
      id: "painted-turtle",
      name: "Painted Turtle",
      biome: "wetland",
      kind: "reptile",
      rarity: "common",
      diet: "Aquatic plants, insects, and small fish",
      shelter: "Muddy pond bottoms; basking logs",
      preferredHabitat: "Still water with basking spots",
      fact: "Painted turtles survive frozen winters by breathing through their skin under the ice.",
      requirements: {
        minHealth: 45,
        objects: {
          "shallow-water-pool": 1,
          "mud-bank": 1,
          "reed-bed": 1
        },
        hint: "Still water and a soft bank to bask on."
      }
    },
    {
      id: "chorus-frog",
      name: "Chorus Frog",
      biome: "wetland",
      kind: "amphibian",
      rarity: "common",
      featured: true,
      diet: "Small insects",
      shelter: "Shallow water and wet vegetation",
      preferredHabitat: "Shallow pools ringed with reeds",
      fact: "A chorus frog's call sounds like a thumb dragged across a comb \u2014 and carries half a mile.",
      requirements: {
        minHealth: 30,
        objects: {
          "shallow-water-pool": 1,
          "reed-bed": 1
        },
        hint: "Shallow water, reeds, and insect life."
      }
    },
    {
      id: "wetland-salamander",
      name: "Tiger Salamander",
      biome: "wetland",
      kind: "amphibian",
      rarity: "uncommon",
      diet: "Worms, insects, and small invertebrates",
      shelter: "Damp burrows near breeding pools",
      preferredHabitat: "Fishless pools with soft banks",
      fact: "Tiger salamanders may live 15 years or more, returning to the same breeding pool each spring.",
      requirements: {
        minHealth: 50,
        objects: {
          "shallow-water-pool": 1,
          "mud-bank": 1,
          "reed-bed": 1
        },
        hint: "Quiet breeding pools with soft digging banks."
      }
    },
    {
      id: "dragonfly",
      name: "Dragonfly",
      biome: "wetland",
      kind: "insect",
      rarity: "common",
      featured: true,
      diet: "Mosquitoes and flying insects",
      shelter: "Emergent reed stems",
      preferredHabitat: "Clean water with reed perches",
      fact: "Dragonflies catch up to 95% of the prey they chase \u2014 perhaps the most successful hunters on Earth.",
      requirements: {
        minHealth: 35,
        objects: {
          "shallow-water-pool": 1,
          "reed-bed": 1,
          "sedge-tussock": 1
        },
        hint: "Clean water and reeds for the larvae to climb."
      }
    },
    {
      id: "damselfly",
      name: "Damselfly",
      biome: "wetland",
      kind: "insect",
      rarity: "common",
      diet: "Small flying insects",
      shelter: "Waterside vegetation",
      preferredHabitat: "Calm, clean shallows",
      fact: "Unlike dragonflies, damselflies fold their wings together over their backs at rest.",
      requirements: {
        minHealth: 35,
        objects: {
          "shallow-water-pool": 1,
          "reed-bed": 1,
          "sedge-tussock": 1
        },
        hint: "Calm, clean water with plants at the edge."
      }
    },
    {
      id: "water-strider",
      name: "Water Strider",
      biome: "wetland",
      kind: "insect",
      rarity: "common",
      diet: "Insects trapped on the water surface",
      shelter: "Still water surfaces",
      preferredHabitat: "Any calm pool",
      fact: "Water striders ride the surface tension of water on legs covered in thousands of microscopic hairs.",
      requirements: {
        minHealth: 20,
        objects: {
          "shallow-water-pool": 1
        },
        hint: "One calm pool is enough."
      }
    },
    {
      id: "freshwater-fish",
      name: "Freshwater Minnows",
      biome: "wetland",
      kind: "fish",
      rarity: "common",
      diet: "Algae, plankton, and insect larvae",
      shelter: "Deeper pools and reed roots",
      preferredHabitat: "Connected clean pools",
      fact: "Healthy minnow schools are the foundation that herons, otters, and mink all depend on.",
      requirements: {
        minHealth: 35,
        objects: {
          "shallow-water-pool": 2,
          "reed-bed": 1
        },
        hint: "Connected clean pools with reedy cover bring fish back \u2014 and everyone who eats them."
      }
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
      diet: "Grasses, mesquite, and cactus",
      shelter: "Brush cover and borrowed burrows",
      preferredHabitat: "Brushy flats with shade",
      fact: "Desert cottontails get nearly all their water from the plants they eat.",
      requirements: {
        minHealth: 25,
        objects: {
          "desert-brush": 1,
          "burrow-mound": 1
        },
        hint: "Brush for cover and a burrow bank to shelter in."
      }
    },
    {
      id: "kit-fox",
      name: "Kit Fox",
      biome: "desert",
      kind: "mammal",
      rarity: "rare",
      featured: true,
      diet: "Kangaroo rats, rabbits, and insects",
      shelter: "Cool underground dens",
      preferredHabitat: "A thriving desert full of prey",
      fact: "Kit foxes rarely drink water at all, surviving almost entirely on moisture from prey.",
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
        hint: "Kit foxes return when prey is plentiful and dens are ready."
      }
    },
    {
      id: "coyote",
      name: "Coyote",
      biome: "desert",
      kind: "mammal",
      rarity: "rare",
      diet: "Rodents, rabbits, fruit, and insects",
      shelter: "Brushy washes and rock dens",
      preferredHabitat: "Open desert with prey and cover",
      fact: "Coyote pairs duet at dusk; two voices echoing can sound like a whole chorus.",
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
      }
    },
    {
      id: "kangaroo-rat",
      name: "Kangaroo Rat",
      biome: "desert",
      kind: "mammal",
      rarity: "common",
      featured: true,
      diet: "Seeds, carefully cached underground",
      shelter: "Deep burrow systems",
      preferredHabitat: "Loose soil below seed-bearing brush",
      fact: "Kangaroo rats never need to drink \u2014 their bodies make water from dry seeds.",
      requirements: {
        minHealth: 25,
        objects: {
          "burrow-mound": 1,
          "desert-brush": 1
        },
        hint: "Burrow banks and seed plants nearby."
      }
    },
    {
      id: "jackrabbit",
      name: "Black-tailed Jackrabbit",
      biome: "desert",
      kind: "mammal",
      rarity: "common",
      diet: "Grasses, cactus, and shrubs",
      shelter: "Shade forms under brush",
      preferredHabitat: "Open flats with scattered brush",
      fact: "A jackrabbit's enormous ears act like radiators, releasing heat to keep it cool.",
      requirements: {
        minHealth: 30,
        objects: {
          "desert-brush": 2
        },
        hint: "Open running room with brush for shade."
      }
    },
    {
      id: "roadrunner",
      name: "Greater Roadrunner",
      biome: "desert",
      kind: "bird",
      rarity: "uncommon",
      featured: true,
      diet: "Lizards, insects, and small snakes",
      shelter: "Low nests in brush and cactus",
      preferredHabitat: "Open hunting ground with brushy edges",
      fact: "Roadrunners can sprint over 20 mph and will even take on rattlesnakes.",
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
      }
    },
    {
      id: "burrowing-owl",
      name: "Burrowing Owl",
      biome: "desert",
      kind: "bird",
      rarity: "uncommon",
      featured: true,
      diet: "Insects and small rodents",
      shelter: "Underground burrows, often borrowed",
      preferredHabitat: "Burrow mounds with open hunting space",
      fact: "Burrowing owls imitate a rattlesnake's rattle to scare intruders away from their burrows.",
      requirements: {
        minHealth: 55,
        objects: {
          "burrow-mound": 2,
          "desert-brush": 1
        },
        hint: "Ready-made burrows and open ground to hunt over."
      }
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
      fact: "Quail coveys post a lookout on a high branch while the rest of the family feeds.",
      requirements: {
        minHealth: 40,
        objects: {
          "desert-brush": 2,
          "cactus-patch": 1,
          "rock-pile": 1
        },
        hint: "Thick brush to hide a whole covey."
      }
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
      fact: "Desert tortoises can live 80 years, spending 95% of that time underground.",
      requirements: {
        minHealth: 65,
        objects: {
          "burrow-mound": 1,
          "cactus-patch": 1,
          "shaded-rock-shelter": 1
        },
        hint: "Shade, native plants, and burrow habitat."
      }
    },
    {
      id: "horned-lizard",
      name: "Horned Lizard",
      biome: "desert",
      kind: "reptile",
      rarity: "common",
      diet: "Ants, almost exclusively",
      shelter: "Loose sand and rock edges",
      preferredHabitat: "Sunny open ground near ant trails",
      fact: "Horned lizards can squirt blood from their eyes to startle predators.",
      requirements: {
        minHealth: 25,
        objects: {
          "rock-pile": 1,
          "desert-brush": 1
        },
        hint: "Sunny rocks and sandy ground bring the ants \u2014 and the lizards."
      }
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
      fact: "Collared lizards sprint on their hind legs like tiny dinosaurs.",
      requirements: {
        minHealth: 45,
        objects: {
          "rock-pile": 2,
          "desert-brush": 1
        },
        hint: "Plenty of warm rock to perch and hunt from."
      }
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
      fact: "A rattlesnake adds a new rattle segment each time it sheds \u2014 but segments break, so you can't count age.",
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
      }
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
      fact: "Desert tarantulas may live 25 years, most of it within a few feet of one burrow.",
      requirements: {
        minHealth: 45,
        objects: {
          "burrow-mound": 1,
          "desert-brush": 1
        },
        hint: "Quiet, diggable ground."
      }
    },
    {
      id: "scorpion",
      name: "Desert Scorpion",
      biome: "desert",
      kind: "invertebrate",
      rarity: "common",
      diet: "Insects and spiders",
      shelter: "Under rocks and bark",
      preferredHabitat: "Rocky cover with night hunting ground",
      fact: "Scorpions glow blue-green under ultraviolet light \u2014 no one is entirely sure why.",
      requirements: {
        minHealth: 25,
        objects: {
          "rock-pile": 1
        },
        hint: "Rocks to hide beneath by day."
      }
    },
    {
      id: "desert-bee",
      name: "Desert Bee",
      biome: "desert",
      kind: "insect",
      rarity: "common",
      diet: "Cactus flower nectar and pollen",
      shelter: "Tiny ground nests",
      preferredHabitat: "Blooming cactus and brush",
      fact: "Most desert bees are solitary \u2014 a single mother bee digs and stocks her own tiny nest.",
      requirements: {
        minHealth: 20,
        objects: {
          "cactus-patch": 1
        },
        hint: "Cactus blooms are the desert's flower patch."
      }
    },
    {
      id: "mountain-goat",
      name: "Mountain Goat",
      biome: "alpine",
      kind: "mammal",
      rarity: "rare",
      featured: true,
      diet: "Alpine grasses, sedges, and lichens",
      shelter: "Cliff ledges and rocky terrain",
      preferredHabitat: "Steep rock above flowering turf",
      fact: "Mountain goats' cloven hooves have rubbery pads that grip rock like climbing shoes.",
      requirements: {
        minHealth: 70,
        objects: {
          "rock-pile": 2,
          "alpine-wildflower-patch": 2,
          "heather-mat": 1
        },
        hint: "Rocky terrain and restored alpine vegetation."
      }
    },
    {
      id: "bighorn-sheep",
      name: "Bighorn Sheep",
      biome: "alpine",
      kind: "mammal",
      rarity: "rare",
      diet: "Grasses and alpine browse",
      shelter: "Rocky slopes with escape routes",
      preferredHabitat: "Open slopes near cliff safety",
      fact: "A bighorn ram's curled horns can weigh more than all the bones in its body combined.",
      requirements: {
        minHealth: 75,
        objects: {
          "rock-pile": 2,
          "grass-patch": 2,
          "alpine-wildflower-patch": 1
        },
        hint: "Grassy slopes with rocky escape ground."
      }
    },
    {
      id: "pika",
      name: "American Pika",
      biome: "alpine",
      kind: "mammal",
      rarity: "common",
      featured: true,
      diet: "Grasses and wildflowers, dried into haypiles",
      shelter: "Cool gaps deep in talus rock",
      preferredHabitat: "Rock piles beside flower meadows",
      fact: "Pikas spend all summer harvesting and sun-drying little haystacks to eat under the winter snow.",
      requirements: {
        minHealth: 30,
        objects: {
          "rock-pile": 2,
          "alpine-wildflower-patch": 1
        },
        hint: "Cool rock piles and flowers to harvest."
      }
    },
    {
      id: "marmot",
      name: "Yellow-bellied Marmot",
      biome: "alpine",
      kind: "mammal",
      rarity: "common",
      featured: true,
      diet: "Grasses, flowers, and seeds",
      shelter: "Deep burrows under boulders",
      preferredHabitat: "Open meadow patches with burrows",
      fact: "Marmots hibernate up to eight months a year \u2014 more than half their lives are spent asleep.",
      requirements: {
        minHealth: 35,
        objects: {
          "burrow-mound": 1,
          "alpine-wildflower-patch": 1
        },
        hint: "Burrows, meadow patches, and open space."
      }
    },
    {
      id: "snowshoe-hare",
      name: "Snowshoe Hare",
      biome: "alpine",
      kind: "mammal",
      rarity: "uncommon",
      diet: "Grasses, buds, and bark",
      shelter: "Dense low cover",
      preferredHabitat: "Brushy patches near open turf",
      fact: "Snowshoe hares change coat color with the seasons \u2014 brown in summer, white in winter.",
      requirements: {
        minHealth: 40,
        objects: {
          "grass-patch": 2,
          "rock-pile": 1
        },
        hint: "Cover and forage at the treeline."
      }
    },
    {
      id: "elk-alpine",
      name: "Elk",
      biome: "alpine",
      kind: "mammal",
      rarity: "rare",
      diet: "Alpine grasses and forbs",
      shelter: "High meadows in summer",
      preferredHabitat: "Restored high meadows with water",
      fact: "Elk migrate up and down mountains with the seasons, following the 'green wave' of new growth.",
      requirements: {
        minHealth: 70,
        objects: {
          "grass-patch": 2,
          "snowmelt-pool": 1,
          "rock-pile": 1
        },
        hint: "High meadow forage and snowmelt water."
      }
    },
    {
      id: "mule-deer-alpine",
      name: "Mule Deer",
      biome: "alpine",
      kind: "mammal",
      rarity: "uncommon",
      diet: "Alpine browse and forbs",
      shelter: "Krummholz thickets",
      preferredHabitat: "High meadows in summer",
      fact: "Mule deer summer high in the mountains and walk the same routes back down each fall.",
      requirements: {
        minHealth: 55,
        objects: {
          "grass-patch": 1,
          "alpine-wildflower-patch": 1,
          "snowmelt-pool": 1
        },
        hint: "Forage and clean water up high."
      }
    },
    {
      id: "fox-alpine",
      name: "Red Fox",
      biome: "alpine",
      kind: "mammal",
      rarity: "rare",
      diet: "Voles, pikas, and ground birds",
      shelter: "Rock dens",
      preferredHabitat: "High country with small prey",
      fact: "Mountain foxes listen for animals moving beneath deep snow, then dive in headfirst.",
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
      }
    },
    {
      id: "pine-marten",
      name: "Pine Marten",
      biome: "alpine",
      kind: "mammal",
      rarity: "rare",
      diet: "Voles, squirrels, and berries",
      shelter: "Rock crevices and snags",
      preferredHabitat: "Treeline edges with rocky cover",
      fact: "Pine martens hunt beneath the snowpack in winter, using tunnels no one else can reach.",
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
      }
    },
    {
      id: "ptarmigan",
      name: "White-tailed Ptarmigan",
      biome: "alpine",
      kind: "bird",
      rarity: "uncommon",
      featured: true,
      diet: "Buds, seeds, and alpine plants",
      shelter: "Camouflaged ground nests",
      preferredHabitat: "Low shrubs and safe nesting cover",
      fact: "Ptarmigan grow feathered snowshoes on their feet each winter.",
      requirements: {
        minHealth: 55,
        objects: {
          "alpine-wildflower-patch": 1,
          "grass-patch": 1,
          "rock-pile": 1
        },
        hint: "Alpine shrubs and quiet nesting cover."
      }
    },
    {
      id: "clarks-nutcracker",
      name: "Clark's Nutcracker",
      biome: "alpine",
      kind: "bird",
      rarity: "uncommon",
      diet: "Pine seeds, cached by the thousand",
      shelter: "High conifers",
      preferredHabitat: "Treeline with seed sources",
      fact: "A Clark's nutcracker can remember thousands of seed cache locations months later, even under snow.",
      requirements: {
        minHealth: 50,
        objects: {
          "rock-pile": 1,
          "alpine-wildflower-patch": 1,
          "heather-mat": 1
        },
        hint: "A recovering treeline with seeds to cache."
      }
    },
    {
      id: "golden-eagle",
      name: "Golden Eagle",
      biome: "alpine",
      kind: "bird",
      rarity: "rare",
      diet: "Marmots, hares, and ptarmigan",
      shelter: "Cliff eyries",
      preferredHabitat: "High, healthy country with abundant prey",
      fact: "Golden eagles can spot a hare from more than a mile away and dive at over 150 mph.",
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
      }
    },
    {
      id: "alpine-butterfly",
      name: "Alpine Butterfly",
      biome: "alpine",
      kind: "insect",
      rarity: "common",
      diet: "Alpine flower nectar",
      shelter: "Low turf and warm rocks",
      preferredHabitat: "Flowering alpine turf",
      fact: "Some alpine butterflies take two full summers to grow up, pausing each winter under the snow.",
      requirements: {
        minHealth: 25,
        objects: {
          "alpine-wildflower-patch": 1
        },
        hint: "Alpine flowers in bloom."
      }
    },
    {
      id: "bumblebee-alpine",
      name: "Alpine Bumblebee",
      biome: "alpine",
      kind: "insect",
      rarity: "common",
      diet: "Nectar and pollen",
      shelter: "Old burrows in turf",
      preferredHabitat: "High flower patches",
      fact: "Bumblebees shiver their flight muscles to warm up, letting them fly in near-freezing air.",
      requirements: {
        minHealth: 25,
        objects: {
          "alpine-wildflower-patch": 2
        },
        hint: "More flowers, more bees \u2014 even up here."
      }
    },
    {
      id: "snowmelt-trout",
      name: "Cutthroat Trout",
      biome: "alpine",
      kind: "fish",
      rarity: "uncommon",
      diet: "Aquatic insects",
      shelter: "Cold, clean pools",
      preferredHabitat: "Connected snowmelt water",
      fact: "Cutthroat trout need water so cold and clean that their presence is itself a health report for the mountain.",
      requirements: {
        minHealth: 60,
        objects: {
          "snowmelt-pool": 2,
          "rock-pile": 1
        },
        hint: "Cold, clean, connected snowmelt pools."
      }
    },
    {
      id: "tidepool-crab",
      name: "Shore Crab",
      biome: "coastal",
      kind: "invertebrate",
      rarity: "common",
      featured: true,
      diet: "Algae and scraps",
      shelter: "Tidepool rocks and crevices",
      preferredHabitat: "Rocky tidepools",
      fact: "Shore crabs can change color slowly to match their home pool.",
      requirements: {
        minHealth: 25,
        objects: {
          tidepool: 1
        },
        hint: "Restore the tidepools and the crabs scuttle back first."
      }
    },
    {
      id: "hermit-crab",
      name: "Hermit Crab",
      biome: "coastal",
      kind: "invertebrate",
      rarity: "common",
      diet: "Algae and detritus",
      shelter: "Borrowed shells",
      preferredHabitat: "Tidepools with empty shells",
      fact: "When a perfect shell appears, hermit crabs line up by size and swap shells in a chain.",
      requirements: {
        minHealth: 35,
        objects: {
          tidepool: 1,
          "kelp-wrack": 1,
          "dune-grass": 1
        },
        hint: "Tidepools plus washed-up shells to move into."
      }
    },
    {
      id: "sea-star",
      name: "Ochre Sea Star",
      biome: "coastal",
      kind: "invertebrate",
      rarity: "uncommon",
      featured: true,
      diet: "Mussels and barnacles",
      shelter: "Tidepool rock faces",
      preferredHabitat: "Established tidepools with shellfish",
      fact: "Sea stars are keystone predators \u2014 one species' presence reshapes the whole shoreline community.",
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
      }
    },
    {
      id: "anemone",
      name: "Giant Green Anemone",
      biome: "coastal",
      kind: "invertebrate",
      rarity: "common",
      diet: "Small animals caught by stinging tentacles",
      shelter: "Tidepool walls",
      preferredHabitat: "Clear, restored tidepools",
      fact: "The green color comes partly from algae living inside the anemone's tissues \u2014 roommates that pay rent in sugar.",
      requirements: {
        minHealth: 30,
        objects: {
          tidepool: 1
        },
        hint: "Clear, quiet pools."
      }
    },
    {
      id: "mussel",
      name: "California Mussel",
      biome: "coastal",
      kind: "invertebrate",
      rarity: "common",
      diet: "Filtered plankton",
      shelter: "Dense beds on wave-washed rock",
      preferredHabitat: "Rocky shore with clean water",
      fact: "A single mussel filters and cleans several liters of seawater every hour.",
      requirements: {
        minHealth: 30,
        objects: {
          tidepool: 1
        },
        hint: "Clean water over rocky shore."
      }
    },
    {
      id: "clam",
      name: "Pacific Littleneck Clam",
      biome: "coastal",
      kind: "invertebrate",
      rarity: "common",
      diet: "Filtered plankton",
      shelter: "Buried in sand and gravel",
      preferredHabitat: "Stable sand near tidepools",
      fact: "You can estimate a clam's age by counting the growth rings on its shell, like a tree.",
      requirements: {
        minHealth: 30,
        objects: {
          tidepool: 1,
          "dune-grass": 1
        },
        hint: "Stable, quiet sand to dig into."
      }
    },
    {
      id: "shorebird",
      name: "Snowy Plover",
      biome: "coastal",
      kind: "bird",
      rarity: "uncommon",
      featured: true,
      diet: "Sand crustaceans and kelp-fly larvae",
      shelter: "Shallow scrapes hidden in dunes",
      preferredHabitat: "Protected dunes with quiet nesting beach",
      fact: "Snowy plover chicks can run and feed themselves within hours of hatching.",
      requirements: {
        minHealth: 50,
        objects: {
          "dune-grass": 2,
          "coastal-nesting-area": 1,
          tidepool: 1
        },
        hint: "Anchored dunes and a protected stretch of quiet beach."
      }
    },
    {
      id: "gull",
      name: "Western Gull",
      biome: "coastal",
      kind: "bird",
      rarity: "common",
      diet: "Fish, shellfish, and whatever washes up",
      shelter: "Open beach and rocky points",
      preferredHabitat: "Any recovering shoreline",
      fact: "Gulls drop clams onto rocks from the air to crack them open.",
      requirements: {
        minHealth: 20,
        objects: {
          "kelp-wrack": 1
        },
        hint: "Gulls show up as soon as there's a beach worth patrolling."
      }
    },
    {
      id: "pelican",
      name: "Brown Pelican",
      biome: "coastal",
      kind: "bird",
      rarity: "uncommon",
      diet: "Fish caught in plunge dives",
      shelter: "Quiet roosts on rocks and sand",
      preferredHabitat: "Fish-rich water with quiet roosts",
      fact: "Brown pelicans dive from 30 feet up, with air sacs under the skin to cushion the splash.",
      requirements: {
        minHealth: 55,
        objects: {
          "coastal-nesting-area": 1,
          tidepool: 1,
          "dune-grass": 1
        },
        hint: "Quiet roosting space and fishable water."
      }
    },
    {
      id: "cormorant",
      name: "Pelagic Cormorant",
      biome: "coastal",
      kind: "bird",
      rarity: "uncommon",
      diet: "Fish chased underwater",
      shelter: "Cliff and rock roosts",
      preferredHabitat: "Rocky shore with diving water",
      fact: "Cormorant feathers soak through on purpose \u2014 less buoyancy makes them better divers.",
      requirements: {
        minHealth: 55,
        objects: {
          tidepool: 2,
          "dune-grass": 1
        },
        hint: "Healthy rocky shallows to dive in."
      }
    },
    {
      id: "sea-turtle",
      name: "Green Sea Turtle",
      biome: "coastal",
      kind: "reptile",
      rarity: "rare",
      diet: "Seagrass and algae",
      shelter: "Offshore waters; nests on quiet sand",
      preferredHabitat: "Clean water and undisturbed beach",
      fact: "Green sea turtles return to nest on the very beach where they hatched, decades later.",
      requirements: {
        minHealth: 75,
        objects: {
          "coastal-nesting-area": 1,
          "dune-grass": 2,
          "kelp-wrack": 1
        },
        hint: "An undisturbed nesting beach and clean water."
      }
    },
    {
      id: "harbor-seal",
      name: "Harbor Seal",
      biome: "coastal",
      kind: "mammal",
      rarity: "rare",
      featured: true,
      diet: "Fish and squid",
      shelter: "Quiet haul-out beaches",
      preferredHabitat: "Calm, clean water with undisturbed shore",
      fact: "Harbor seals can sleep underwater, surfacing to breathe without fully waking.",
      requirements: {
        minHealth: 70,
        objects: {
          "coastal-nesting-area": 1,
          tidepool: 1,
          "dune-grass": 1
        },
        hint: "Quiet beaches and clean water \u2014 seals need calm above all."
      }
    },
    {
      id: "sea-otter",
      name: "Sea Otter",
      biome: "coastal",
      kind: "mammal",
      rarity: "rare",
      diet: "Sea urchins, crabs, and shellfish",
      shelter: "Kelp canopy anchor points",
      preferredHabitat: "Kelp habitat with abundant shellfish",
      fact: "Sea otters wrap themselves in kelp before sleeping so they don't drift away \u2014 and sometimes hold hands.",
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
      }
    },
    {
      id: "dolphin",
      name: "Bottlenose Dolphin",
      biome: "coastal",
      kind: "mammal",
      rarity: "rare",
      diet: "Fish and squid",
      shelter: "Open coastal water",
      preferredHabitat: "Clean, lively nearshore water",
      fact: "Dolphins call each other by name, using signature whistles unique to each individual.",
      requirements: {
        minHealth: 75,
        objects: {
          tidepool: 2,
          "kelp-wrack": 1,
          "dune-grass": 1
        },
        hint: "A clean, busy shoreline brings dolphins close in."
      }
    },
    {
      id: "migrating-whale",
      name: "Gray Whale",
      biome: "coastal",
      kind: "mammal",
      rarity: "rare",
      diet: "Tiny crustaceans sifted from the seafloor",
      shelter: "Open ocean; passes close to healthy shores",
      preferredHabitat: "Seen offshore from a fully restored coast",
      fact: "Gray whales make one of the longest migrations of any mammal \u2014 up to 14,000 miles round trip.",
      requirements: {
        minHealth: 75,
        minBalance: 50,
        objects: {
          tidepool: 2,
          "dune-grass": 2,
          "coastal-nesting-area": 1
        },
        hint: "Only a truly thriving shore earns a whale sighting. Watch the horizon."
      }
    },
    {
      id: "american-goldfinch",
      name: "American Goldfinch",
      biome: "meadow",
      kind: "bird",
      rarity: "common",
      featured: false,
      diet: "Thistle and wildflower seeds",
      shelter: "Shrubby field edges",
      preferredHabitat: "Open wildflower meadow with perches",
      fact: "They nest late so their chicks hatch with the thistle seed crop.",
      requirements: {
        minHealth: 45,
        objects: {
          "wildflower-patch": 1,
          "bird-perch": 1,
          shrub: 1
        },
        hint: "Plant a wildflower patch and add a bird perch."
      }
    },
    {
      id: "eastern-bluebird",
      name: "Eastern Bluebird",
      biome: "meadow",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Insects and berries",
      shelter: "Cavities and nest boxes",
      preferredHabitat: "Grassy openings with scattered perches",
      fact: "A pair will raise two or three broods in a single good season.",
      requirements: {
        minHealth: 55,
        objects: {
          "bird-perch": 1,
          "native-grass-patch": 1,
          "berry-bush": 1
        },
        hint: "Native grass, a berry bush, and a perch to hunt from."
      }
    },
    {
      id: "leafcutter-bee",
      name: "Leafcutter Bee",
      biome: "meadow",
      kind: "insect",
      rarity: "common",
      featured: false,
      diet: "Pollen and nectar",
      shelter: "Hollow stems and soft soil",
      preferredHabitat: "Clover and wildflowers",
      fact: "They snip neat half-circles from leaves to line their nests.",
      requirements: {
        minHealth: 40,
        objects: {
          "clover-patch": 1,
          "wildflower-patch": 1,
          shrub: 1
        },
        hint: "Clover and wildflowers side by side."
      }
    },
    {
      id: "painted-lady",
      name: "Painted Lady",
      biome: "meadow",
      kind: "insect",
      rarity: "common",
      featured: false,
      diet: "Flower nectar",
      shelter: "Sheltered grass",
      preferredHabitat: "Sunny flowering meadow",
      fact: "Painted ladies migrate thousands of miles across continents.",
      requirements: {
        minHealth: 40,
        objects: {
          "butterfly-flowers": 1,
          "clover-patch": 1,
          shrub: 1
        },
        hint: "Butterfly flowers near a clover patch."
      }
    },
    {
      id: "american-badger",
      name: "American Badger",
      biome: "meadow",
      kind: "mammal",
      rarity: "rare",
      featured: false,
      diet: "Ground squirrels and voles",
      shelter: "Dug burrows",
      preferredHabitat: "Open grassland with prey and cover",
      fact: "Badgers and coyotes sometimes hunt the same fields together.",
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
      }
    },
    {
      id: "pileated-woodpecker",
      name: "Pileated Woodpecker",
      biome: "forest",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Carpenter ants and beetle grubs",
      shelter: "Dead trees",
      preferredHabitat: "Mature forest with standing deadwood",
      fact: "Their rectangular excavations later become homes for other animals.",
      requirements: {
        minHealth: 55,
        objects: {
          "standing-deadwood": 1,
          "nesting-tree": 1,
          shrub: 1
        },
        hint: "Standing deadwood beside a nesting tree."
      }
    },
    {
      id: "pacific-wren",
      name: "Pacific Wren",
      biome: "forest",
      kind: "bird",
      rarity: "common",
      featured: false,
      diet: "Forest-floor insects",
      shelter: "Root tangles and ferns",
      preferredHabitat: "Damp shaded understory",
      fact: "A tiny bird with a song of over thirty notes per second.",
      requirements: {
        minHealth: 50,
        objects: {
          "fern-grove": 1,
          "mushroom-log": 1,
          shrub: 1
        },
        hint: "Ferns and a mushroom log in the shade."
      }
    },
    {
      id: "rough-skinned-newt",
      name: "Rough-skinned Newt",
      biome: "forest",
      kind: "amphibian",
      rarity: "uncommon",
      featured: false,
      diet: "Insects and worms",
      shelter: "Logs and leaf litter",
      preferredHabitat: "Forest pools and damp ground",
      fact: "Their skin carries one of the most potent natural toxins known.",
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
      }
    },
    {
      id: "northern-flying-squirrel",
      name: "Northern Flying Squirrel",
      biome: "forest",
      kind: "mammal",
      rarity: "rare",
      featured: false,
      diet: "Fungi, lichen, and seeds",
      shelter: "Tree cavities",
      preferredHabitat: "Old forest with connected canopy",
      fact: "They glide between trees and help spread truffle spores.",
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
      }
    },
    {
      id: "wood-duck",
      name: "Wood Duck",
      biome: "forest",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Seeds, acorns, and insects",
      shelter: "Tree cavities over water",
      preferredHabitat: "Wooded pools and slow water",
      fact: "Ducklings leap from high nest cavities the day after hatching.",
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
      }
    },
    {
      id: "american-bittern",
      name: "American Bittern",
      biome: "wetland",
      kind: "bird",
      rarity: "rare",
      featured: false,
      diet: "Fish, frogs, and insects",
      shelter: "Dense reeds",
      preferredHabitat: "Tall marsh vegetation",
      fact: "It freezes with its bill skyward to vanish among the reeds.",
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
        hint: "Thick reeds and cattails beside open water."
      }
    },
    {
      id: "belted-kingfisher",
      name: "Belted Kingfisher",
      biome: "wetland",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Small fish",
      shelter: "Earthen bank burrows",
      preferredHabitat: "Clear flowing water with perches",
      fact: "They dig nesting tunnels up to two metres into a stream bank.",
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
      }
    },
    {
      id: "northern-leopard-frog",
      name: "Northern Leopard Frog",
      biome: "wetland",
      kind: "amphibian",
      rarity: "common",
      featured: false,
      diet: "Insects and spiders",
      shelter: "Shallow water and grass",
      preferredHabitat: "Lily-fringed shallows",
      fact: "Their loud snore-like call carries across the marsh at night.",
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
      }
    },
    {
      id: "snapping-turtle",
      name: "Snapping Turtle",
      biome: "wetland",
      kind: "reptile",
      rarity: "uncommon",
      featured: false,
      diet: "Fish, plants, and carrion",
      shelter: "Muddy lake bottoms",
      preferredHabitat: "Deep still water with mud",
      fact: "They can live for over a century in the same quiet pond.",
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
      }
    },
    {
      id: "marsh-wren",
      name: "Marsh Wren",
      biome: "wetland",
      kind: "bird",
      rarity: "common",
      featured: false,
      diet: "Marsh insects",
      shelter: "Woven reed nests",
      preferredHabitat: "Cattail and sedge stands",
      fact: "Males build many dummy nests to court a mate.",
      requirements: {
        minHealth: 50,
        objects: {
          "reed-bed": 2,
          "sedge-tussock": 1,
          "shallow-water-pool": 1
        },
        hint: "Two reed beds and a sedge tussock."
      }
    },
    {
      id: "gila-woodpecker",
      name: "Gila Woodpecker",
      biome: "desert",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Insects, cactus fruit",
      shelter: "Cactus cavities",
      preferredHabitat: "Saguaro and cactus stands",
      fact: "Their abandoned cactus holes shelter owls and lizards later.",
      requirements: {
        minHealth: 50,
        objects: {
          "cactus-patch": 2,
          "desert-brush": 1
        },
        hint: "Two cactus patches for nesting cavities."
      }
    },
    {
      id: "cactus-wren",
      name: "Cactus Wren",
      biome: "desert",
      kind: "bird",
      rarity: "common",
      featured: false,
      diet: "Insects and seeds",
      shelter: "Thorny cactus and brush",
      preferredHabitat: "Open desert with cactus",
      fact: "They build football-shaped nests deep in spiny cholla.",
      requirements: {
        minHealth: 45,
        objects: {
          "cactus-patch": 1,
          "desert-brush": 1,
          "rock-pile": 1
        },
        hint: "A cactus patch and desert brush."
      }
    },
    {
      id: "desert-iguana",
      name: "Desert Iguana",
      biome: "desert",
      kind: "reptile",
      rarity: "uncommon",
      featured: false,
      diet: "Flowers and leaves",
      shelter: "Burrows under shrubs",
      preferredHabitat: "Hot sandy flats with cover",
      fact: "It stays active at temperatures that drive other lizards to shade.",
      requirements: {
        minHealth: 50,
        objects: {
          "agave-rosette": 1,
          "rock-pile": 1,
          "desert-brush": 1
        },
        hint: "An agave rosette and a rock pile."
      }
    },
    {
      id: "kangaroo-mouse",
      name: "Kangaroo Mouse",
      biome: "desert",
      kind: "mammal",
      rarity: "uncommon",
      featured: false,
      diet: "Seeds",
      shelter: "Sand burrows",
      preferredHabitat: "Fine sandy desert",
      fact: "It survives on metabolic water and may never drink at all.",
      requirements: {
        minHealth: 50,
        objects: {
          "burrow-mound": 1,
          "desert-brush": 1,
          "cactus-patch": 1
        },
        hint: "A burrow mound near desert brush."
      }
    },
    {
      id: "banded-gecko",
      name: "Western Banded Gecko",
      biome: "desert",
      kind: "reptile",
      rarity: "common",
      featured: false,
      diet: "Insects and spiders",
      shelter: "Rock crevices",
      preferredHabitat: "Sheltered rocky desert",
      fact: "Unlike most geckos it has movable eyelids and a soft voice.",
      requirements: {
        minHealth: 45,
        objects: {
          ocotillo: 1,
          "shaded-rock-shelter": 1,
          "desert-brush": 1
        },
        hint: "Ocotillo beside a shaded rock shelter."
      }
    },
    {
      id: "rosy-finch",
      name: "Gray-crowned Rosy-Finch",
      biome: "alpine",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Seeds and insects",
      shelter: "Cliff crevices",
      preferredHabitat: "High talus and wildflower turf",
      fact: "They nest higher than almost any other songbird in North America.",
      requirements: {
        minHealth: 50,
        objects: {
          "alpine-wildflower-patch": 1,
          "rock-pile": 1,
          "heather-mat": 1
        },
        hint: "Alpine wildflowers and a rock pile."
      }
    },
    {
      id: "american-pipit",
      name: "American Pipit",
      biome: "alpine",
      kind: "bird",
      rarity: "common",
      featured: false,
      diet: "Insects and seeds",
      shelter: "Tundra tussocks",
      preferredHabitat: "Open alpine meadow",
      fact: "It bobs its tail constantly as it walks the high meadows.",
      requirements: {
        minHealth: 50,
        objects: {
          "heather-mat": 1,
          "alpine-wildflower-patch": 1,
          "rock-pile": 1
        },
        hint: "A heather mat and alpine wildflowers."
      }
    },
    {
      id: "ermine",
      name: "Ermine",
      biome: "alpine",
      kind: "mammal",
      rarity: "rare",
      featured: false,
      diet: "Small rodents",
      shelter: "Rock crevices and burrows",
      preferredHabitat: "Talus near meadows",
      fact: "Its coat turns pure white in winter except for a black tail tip.",
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
        hint: "Rock pile and krummholz, once pikas are back."
      }
    },
    {
      id: "boreal-toad",
      name: "Boreal Toad",
      biome: "alpine",
      kind: "amphibian",
      rarity: "uncommon",
      featured: false,
      diet: "Insects",
      shelter: "Damp shelter near pools",
      preferredHabitat: "Snowmelt ponds and seeps",
      fact: "They can take years to mature in the short alpine summers.",
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
      }
    },
    {
      id: "mountain-bluebird",
      name: "Mountain Bluebird",
      biome: "alpine",
      kind: "bird",
      rarity: "common",
      featured: false,
      diet: "Insects",
      shelter: "Tree-line cavities",
      preferredHabitat: "High meadows with scattered trees",
      fact: "Males are an almost unreal sky-blue all over.",
      requirements: {
        minHealth: 50,
        objects: {
          "krummholz-pine": 1,
          "alpine-wildflower-patch": 1,
          "rock-pile": 1
        },
        hint: "A krummholz pine and alpine wildflowers."
      }
    },
    {
      id: "sanderling",
      name: "Sanderling",
      biome: "coastal",
      kind: "bird",
      rarity: "common",
      featured: false,
      diet: "Tiny crustaceans",
      shelter: "Open beach",
      preferredHabitat: "Sandy surf line",
      fact: "They chase the retreating waves in busy little sprints.",
      requirements: {
        minHealth: 50,
        objects: {
          "dune-grass": 2,
          tidepool: 1,
          "kelp-wrack": 1
        },
        hint: "Two dune-grass plantings and a tidepool."
      }
    },
    {
      id: "black-oystercatcher",
      name: "Black Oystercatcher",
      biome: "coastal",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Mussels and limpets",
      shelter: "Rocky shore ledges",
      preferredHabitat: "Tidepool reefs",
      fact: "Its long red bill pries shellfish from the rocks.",
      requirements: {
        minHealth: 55,
        objects: {
          "oyster-bed": 1,
          tidepool: 1,
          "dune-grass": 1
        },
        hint: "An oyster bed beside a tidepool."
      }
    },
    {
      id: "purple-shore-crab",
      name: "Purple Shore Crab",
      biome: "coastal",
      kind: "invertebrate",
      rarity: "common",
      featured: false,
      diet: "Algae and detritus",
      shelter: "Under rocks",
      preferredHabitat: "Sheltered rocky intertidal",
      fact: "They scuttle sideways under stones when the tide pulls back.",
      requirements: {
        minHealth: 45,
        objects: {
          tidepool: 1,
          "oyster-bed": 1,
          "dune-grass": 1
        },
        hint: "A tidepool and an oyster bed."
      }
    },
    {
      id: "brant-goose",
      name: "Brant Goose",
      biome: "coastal",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Eelgrass",
      shelter: "Open shoreline",
      preferredHabitat: "Shallow bays with eelgrass",
      fact: "Whole flocks depend on eelgrass beds to fuel their migration.",
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
      }
    },
    {
      id: "snowy-plover",
      name: "Western Snowy Plover",
      biome: "coastal",
      kind: "bird",
      rarity: "rare",
      featured: false,
      diet: "Beach invertebrates",
      shelter: "Dune scrapes",
      preferredHabitat: "Quiet sandy dunes",
      fact: "They nest in tiny scrapes right on the open sand.",
      requirements: {
        minHealth: 60,
        objects: {
          "dune-grass": 1,
          "coastal-nesting-area": 1,
          tidepool: 1
        },
        hint: "Dune grass and a coastal nesting area."
      }
    },
    {
      id: "costas-hummingbird",
      name: "Costa's Hummingbird",
      biome: "desert",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Flower nectar and tiny insects",
      shelter: "Shrub and cactus",
      preferredHabitat: "Blooming desert with nectar sources",
      fact: "Males dive and flash violet throat feathers to court a mate.",
      requirements: {
        minHealth: 40,
        objects: {
          "nectar-feeder": 1,
          "cactus-patch": 1
        },
        hint: "A nectar feeder beside a cactus patch."
      }
    },
    {
      id: "coopers-hawk",
      name: "Cooper's Hawk",
      biome: "meadow",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Small birds",
      shelter: "Tree cover",
      preferredHabitat: "Wooded meadow edges",
      fact: "It threads through dense branches at full speed chasing songbirds.",
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
      }
    },
    {
      id: "western-screech-owl",
      name: "Western Screech-Owl",
      biome: "meadow",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Insects and mice",
      shelter: "Tree cavities",
      preferredHabitat: "Oaks with hollows",
      fact: "Its bouncing-ball call rolls through the dusk.",
      requirements: {
        minHealth: 55,
        objects: {
          "oak-tree": 1,
          "hollow-log": 1,
          "log-shelter": 1
        },
        hint: "Plant an oak and craft a hollow log and log shelter."
      }
    },
    {
      id: "barred-owl",
      name: "Barred Owl",
      biome: "forest",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Rodents and amphibians",
      shelter: "Large tree cavities",
      preferredHabitat: "Mature damp woodland",
      fact: "Its 'who-cooks-for-you' call is the voice of the old forest.",
      requirements: {
        minHealth: 55,
        objects: {
          "nesting-tree": 1,
          "oak-tree": 1,
          "standing-deadwood": 1
        },
        hint: "A nesting tree, a planted oak, and standing deadwood."
      }
    },
    {
      id: "fisher",
      name: "Fisher",
      biome: "forest",
      kind: "mammal",
      rarity: "rare",
      featured: false,
      diet: "Small mammals",
      shelter: "Tree dens and stumps",
      preferredHabitat: "Dense old forest",
      fact: "One of the few predators that can hunt porcupines.",
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
      }
    },
    {
      id: "prothonotary-warbler",
      name: "Prothonotary Warbler",
      biome: "wetland",
      kind: "bird",
      rarity: "rare",
      featured: false,
      diet: "Insects",
      shelter: "Cavities over water",
      preferredHabitat: "Flooded cypress swamp",
      fact: "A glowing-gold warbler that nests in holes above the water.",
      requirements: {
        minHealth: 55,
        objects: {
          "bald-cypress": 1,
          "reed-bed": 1,
          "nesting-platform": 1
        },
        hint: "Plant a bald cypress with a reed bed and nesting platform."
      }
    },
    {
      id: "green-heron",
      name: "Green Heron",
      biome: "wetland",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Fish and frogs",
      shelter: "Overhanging branches",
      preferredHabitat: "Quiet wooded shallows",
      fact: "One of the few birds that uses bait \u2014 dropping insects to lure fish.",
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
      }
    },
    {
      id: "elf-owl",
      name: "Elf Owl",
      biome: "desert",
      kind: "bird",
      rarity: "rare",
      featured: false,
      diet: "Insects and scorpions",
      shelter: "Cactus and tree cavities",
      preferredHabitat: "Mesquite and saguaro desert",
      fact: "The smallest owl in the world, no bigger than a sparrow.",
      requirements: {
        minHealth: 55,
        objects: {
          "mesquite-tree": 1,
          "desert-ironwood": 1,
          "cactus-patch": 1
        },
        hint: "Plant a mesquite and an ironwood beside a cactus patch."
      }
    },
    {
      id: "mountain-chickadee",
      name: "Mountain Chickadee",
      biome: "alpine",
      kind: "bird",
      rarity: "common",
      featured: false,
      diet: "Insects and conifer seeds",
      shelter: "Conifer cavities",
      preferredHabitat: "High evergreen slopes",
      fact: "It caches thousands of seeds and remembers where it hid them.",
      requirements: {
        minHealth: 55,
        objects: {
          "subalpine-fir": 1,
          "krummholz-pine": 1,
          "alpine-wildflower-patch": 1
        },
        hint: "Plant a subalpine fir and krummholz with alpine wildflowers."
      }
    },
    {
      id: "pine-grosbeak",
      name: "Pine Grosbeak",
      biome: "alpine",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Buds, seeds, berries",
      shelter: "Dense conifers",
      preferredHabitat: "Subalpine forest",
      fact: "A plump, unhurried finch of the cold high forests.",
      requirements: {
        minHealth: 55,
        objects: {
          "quaking-aspen": 1,
          "subalpine-fir": 1,
          "rock-pile": 1
        },
        hint: "Plant an aspen and a subalpine fir near a rock pile."
      }
    },
    {
      id: "annas-hummingbird",
      name: "Anna's Hummingbird",
      biome: "coastal",
      kind: "bird",
      rarity: "common",
      featured: false,
      diet: "Nectar and insects",
      shelter: "Shrubs and small trees",
      preferredHabitat: "Flowering coastal scrub",
      fact: "Males dive 27 m and pull up with a loud chirp from their tail feathers.",
      requirements: {
        minHealth: 50,
        objects: {
          "monterey-cypress": 1,
          "dune-grass": 1,
          "sea-thrift": 1
        },
        hint: "Plant a Monterey cypress with dune grass and sea thrift."
      }
    },
    {
      id: "acorn-woodpecker",
      name: "Acorn Woodpecker",
      biome: "coastal",
      kind: "bird",
      rarity: "uncommon",
      featured: false,
      diet: "Acorns and insects",
      shelter: "Oak granary trees",
      preferredHabitat: "Coastal oak woodland",
      fact: "It drills thousands of holes in a 'granary tree' and stores an acorn in each.",
      requirements: {
        minHealth: 55,
        objects: {
          "coast-live-oak": 1,
          "driftwood-shelter": 1,
          tidepool: 1
        },
        hint: "Plant a coast live oak near a driftwood shelter and tidepool."
      }
    }
  ]
};

// server/resources.ts
var db = () => databases.wildwillows;
var GameError = class extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
};
var clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
function posInt(n, label) {
  const v = Number(n);
  if (!Number.isInteger(v) || v <= 0) throw new GameError(`${label} must be a positive whole number`);
  return v;
}
function sumValues(obj) {
  if (!obj) return 0;
  return Object.values(obj).reduce((a, b) => a + (b || 0), 0);
}
async function toArray(iterable) {
  const out = [];
  for await (const item of iterable) out.push(item);
  return out;
}
async function allOf(table) {
  return toArray(table.search({}));
}
async function byPlayer(table, playerId) {
  const rows = await toArray(table.search({}));
  return rows.filter((r) => r?.playerId === playerId);
}
var defsReconciled = false;
async function reconcileDefinitions() {
  if (defsReconciled) return;
  defsReconciled = true;
  const t = db();
  const sources = [
    [t.Biome, biomes_default.records],
    [t.Recipe, recipes_default.records],
    [t.HabitatObject, habitat_objects_default.records],
    [t.ToolDef, tools_default.records],
    [t.ResourceType, resources_default.records],
    [t.Animal, [...animals_1_default.records, ...animals_2_default.records]]
  ];
  for (const [table, records] of sources) {
    const valid = new Set(records.map((r) => r.id));
    for (const row of await toArray(table.search({}))) {
      if (!valid.has(row.id)) await table.delete(row.id);
    }
  }
}
var defsCache = null;
async function defs() {
  await reconcileDefinitions();
  if (!defsCache) {
    const t = db();
    const [biomes, animals, resources, recipes, objects, tools] = await Promise.all([
      allOf(t.Biome),
      allOf(t.Animal),
      allOf(t.ResourceType),
      allOf(t.Recipe),
      allOf(t.HabitatObject),
      allOf(t.ToolDef)
    ]);
    const index = (arr) => new Map(arr.map((r) => [r.id, r]));
    defsCache = {
      biomes,
      animals,
      resources,
      recipes,
      objects,
      tools,
      biome: index(biomes),
      animal: index(animals),
      resource: index(resources),
      recipe: index(recipes),
      object: index(objects),
      tool: index(tools)
    };
  }
  return defsCache;
}
var NODE_REGEN_SECONDS = 75;
var BASE_HEALTH = 5;
var CAPACITY_BY_BASKET = { 1: 80, 2: 160, 3: 260, 4: 380 };
var START_INVENTORY = { seeds: 6, fiber: 4, branches: 4, stones: 2, water: 2 };
var START_TOOLS = { basket: 1, shovel: 1, "watering-can": 1, "field-journal": 1 };
var SKIN_TONES = ["#f6d7b8", "#eec39a", "#d9a06b", "#b97f50", "#8d5a3a", "#6b4226"];
var HAIR_COLORS = ["#3b2e25", "#6e4a33", "#a3692f", "#c9913f", "#d9b380", "#8c8c8c", "#b5707a", "#4a5a3a"];
var OUTFIT_COLORS = ["#4a7c59", "#7a9ac0", "#b5707a", "#c9913f", "#7d6b9e", "#5d8a8a", "#a3692f", "#666f7b"];
var HAT_STYLES = ["straw", "leaf", "beanie", "none"];
var HAIRSTYLES = ["short", "long", "curly", "curly-long", "bun"];
var BODY_TYPES = ["slim", "round"];
function sanitizeAppearance(a) {
  a = a || {};
  return {
    skin: SKIN_TONES.includes(a.skin) ? a.skin : SKIN_TONES[1],
    hair: HAIR_COLORS.includes(a.hair) ? a.hair : HAIR_COLORS[1],
    outfit: OUTFIT_COLORS.includes(a.outfit) ? a.outfit : OUTFIT_COLORS[0],
    hat: HAT_STYLES.includes(a.hat) ? a.hat : "straw",
    hairstyle: HAIRSTYLES.includes(a.hairstyle) ? a.hairstyle : "short",
    body: BODY_TYPES.includes(a.body) ? a.body : "slim"
  };
}
function sanitizePlayer(player) {
  if (!player) return player;
  const { passcode, ...rest } = player;
  return rest;
}
function slugId(name) {
  return String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
var STARTER_CHEST = { x: 9, y: 5, size: "small-chest", capacity: 60 };
async function requirePlayer(playerId) {
  if (!playerId || typeof playerId !== "string") throw new GameError("playerId required");
  const player = await db().Player.get(playerId);
  if (!player) throw new GameError("No save found \u2014 please log in again", 404);
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
async function bumpMetrics(player, deltas = {}) {
  if (!player?.id) return null;
  const entries = Object.entries(deltas).filter(([, v]) => v);
  if (!entries.length) return player.metrics || null;
  const now = Date.now();
  const prev = player.metrics || freshMetrics(player.createdAt || now);
  const counts = { ...prev.counts || {} };
  for (const [k, v] of entries) counts[k] = (counts[k] || 0) + v;
  const metrics = { ...prev, counts, lastSeenAt: now };
  await db().Player.patch(player.id, { metrics });
  return metrics;
}
var DAY_MS = 864e5;
var round1 = (n) => Math.round(n * 10) / 10;
function metricsView(player) {
  const now = Date.now();
  const m = player.metrics || freshMetrics(player.createdAt || now);
  const playSeconds = m.playSeconds || 0;
  const sessions = m.sessions || 0;
  const counts = m.counts || {};
  const totalActions = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
  const createdAt = player.createdAt || m.firstSeenAt || now;
  const lastSeenAt = m.lastSeenAt || null;
  const hoursSinceActive = lastSeenAt ? round1((now - lastSeenAt) / 36e5) : null;
  const daysSinceJoined = Math.floor((now - createdAt) / DAY_MS);
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
    isNewToday: now - createdAt <= DAY_MS,
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
var TERRAIN_COLORS = {
  tilled: "#8a6a48",
  watered: "#6b4f33",
  water: "#5d96c8"
};
function lerpHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const mix = (sh) => {
    const ca = pa >> sh & 255;
    const cb = pb >> sh & 255;
    return Math.round(ca + (cb - ca) * clamp(t, 0, 1));
  };
  return "#" + [mix(16), mix(8), mix(0)].map((n) => n.toString(16).padStart(2, "0")).join("");
}
var svgEscape = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function renderBiomeSVG(d, biome, health, placements, terrain) {
  const cell = 16;
  const pad = 8;
  const labelH = 22;
  const W = GRID_W * cell + pad * 2;
  const H = GRID_H * cell + pad * 2 + labelH;
  const damaged = biome?.palette?.damaged || "#b9a37c";
  const healthy = biome?.palette?.healthy || "#8fbf6f";
  const ground = lerpHex(damaged, healthy, health / 100);
  const groundDark = lerpHex(damaged, healthy, health / 100 * 0.8);
  const px = (x) => pad + x * cell;
  const py = (y) => pad + y * cell;
  const parts = [];
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" rx="10" fill="${ground}"/>`);
  for (let gy = 0; gy < GRID_H; gy++) {
    for (let gx = 0; gx < GRID_W; gx++) {
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
  const t = db();
  const d = await defs();
  const states = await byPlayer(t.BiomeState, playerId);
  const byId = new Map(states.map((s) => [s.biomeId, s]));
  const placements = opts.images ? await byPlayer(t.Placement, playerId) : [];
  const terrain = opts.images ? await byPlayer(t.TerrainTile, playerId) : [];
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
async function createPlayerRecords(playerId, name, passcode, appearance) {
  const t = db();
  const d = await defs();
  const now = Date.now();
  const player = {
    id: playerId,
    name,
    passcode,
    appearance,
    createdAt: now,
    area: "meadow",
    x: 10.5,
    // spawn right beside the camp workbench
    y: 6.5,
    inventory: { ...START_INVENTORY },
    craftedItems: {},
    tools: { ...START_TOOLS },
    unlockedBiomes: ["meadow"],
    tutorialStep: 0,
    metrics: freshMetrics(now)
  };
  await t.Player.put(player);
  const biomeStates = d.biomes.map((b) => ({
    id: `${playerId}:${b.id}`,
    playerId,
    biomeId: b.id,
    health: BASE_HEALTH,
    balance: 0,
    returnedCount: 0,
    unlocked: b.id === "meadow"
  }));
  for (const bs of biomeStates) await t.BiomeState.put(bs);
  const chestPlacementId = `pl_${playerId}_starter-chest`;
  const placements = [
    {
      id: chestPlacementId,
      playerId,
      objectId: "small-chest",
      area: "meadow",
      x: STARTER_CHEST.x,
      y: STARTER_CHEST.y,
      placedAt: now
    }
  ];
  for (const p of placements) await t.Placement.put(p);
  const chest = {
    id: chestPlacementId,
    playerId,
    area: "meadow",
    x: STARTER_CHEST.x,
    y: STARTER_CHEST.y,
    size: "small-chest",
    capacity: STARTER_CHEST.capacity,
    contents: {}
  };
  await t.Chest.put(chest);
  return { player, seeded: { biomeStates, placements, chests: [chest] } };
}
function freshSnapshot(created) {
  return {
    player: sanitizePlayer(created.player),
    biomeStates: created.seeded.biomeStates,
    placements: created.seeded.placements,
    chests: created.seeded.chests,
    discoveries: [],
    nodeStates: [],
    terrain: [],
    serverTime: Date.now(),
    nodeRegenSeconds: NODE_REGEN_SECONDS,
    inventoryCapacity: inventoryCapacity(created.player)
  };
}
function inventoryCapacity(player) {
  const tier = player.tools?.basket || 1;
  return CAPACITY_BY_BASKET[tier] || 80;
}
function placementCounts(placements) {
  const counts = {};
  for (const p of placements) counts[p.objectId] = (counts[p.objectId] || 0) + 1;
  return counts;
}
var HEALTH_SCALE = 90;
function healthFromPoints(points) {
  const recovered = (100 - BASE_HEALTH) * (1 - Math.exp(-Math.max(0, points) / HEALTH_SCALE));
  return clamp(Math.round(BASE_HEALTH + recovered), 0, 100);
}
function computeHealthPoints(d, placements, openWaterTiles = 0) {
  let points = 0;
  for (const p of placements) {
    const def = d.object.get(p.objectId);
    if (!def) continue;
    points += def.healthValue || 0;
  }
  if (openWaterTiles > 0) points += 2 * Math.min(openWaterTiles, 7);
  return points;
}
var BALANCE_PER_ANIMAL = 7;
function balanceFromReturns(returnedCount) {
  return clamp(returnedCount * BALANCE_PER_ANIMAL, 0, 100);
}
function analyzeWater(terrain) {
  const cells = new Set(terrain.filter((t) => t.type === "water").map((t) => `${t.x},${t.y}`));
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
function meetsRequirements(animal, health, balance, counts, returnedIds, water) {
  const req = animal.requirements || {};
  if (health < (req.minHealth || 0)) return false;
  if (balance < (req.minBalance || 0)) return false;
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
  let comfort = 40;
  let missing = 0;
  for (const [objectId, qty] of Object.entries(req)) {
    const have = counts[objectId] || 0;
    if (have >= qty) {
      comfort += 12;
      comfort += Math.min(3, have - qty) * 5;
    } else {
      missing++;
    }
  }
  comfort -= missing * 25;
  return clamp(comfort, 5, 100);
}
function whyReturnedText(animal, d) {
  const req = animal.requirements || {};
  const parts = [];
  const objs = Object.entries(req.objects || {}).map(([id, q]) => `${q}\xD7 ${d.object.get(id)?.name || id}`);
  if (objs.length) parts.push(`habitat in place (${objs.join(", ")})`);
  if (req.water) {
    const w = req.water;
    if (w.lake) parts.push(`a lake of ${w.lake}+ open-water tiles`);
    else if (w.river) parts.push(`a river ${w.river}+ tiles long`);
    else if (w.tiles) parts.push(`${w.tiles}+ open-water tiles`);
  }
  if (req.minHealth) parts.push(`biome health reached ${req.minHealth}%`);
  if (req.minBalance) parts.push(`ecological balance reached ${req.minBalance}%`);
  if (req.animals?.length) parts.push(`${req.animals.map((a) => d.animal.get(a)?.name || a).join(" and ")} had already returned`);
  return `Felt safe enough to return once ${parts.join(", ")}.`;
}
async function recalcBiome(playerId, biomeId, opts = {}) {
  const t = db();
  const d = await defs();
  if (!d.biome.get(biomeId)) throw new GameError(`Unknown biome: ${biomeId}`);
  let placements = (await byPlayer(t.Placement, playerId)).filter((p) => p.area === biomeId);
  if (opts.removeIds?.length) placements = placements.filter((p) => !opts.removeIds.includes(p.id));
  for (const ap of opts.addPlacements || []) {
    if (ap.area !== biomeId) continue;
    placements = placements.filter((p) => p.id !== ap.id);
    placements.push(ap);
  }
  const counts = placementCounts(placements);
  let terrain = (await byPlayer(t.TerrainTile, playerId)).filter((tt) => tt.area === biomeId);
  if (opts.removeTerrainIds?.length) terrain = terrain.filter((tt) => !opts.removeTerrainIds.includes(tt.id));
  for (const at of opts.addTerrain || []) {
    if (at.area !== biomeId) continue;
    terrain = terrain.filter((tt) => tt.id !== at.id);
    terrain.push(at);
  }
  const wateredTiles = Math.min(10, terrain.filter((tt) => tt.type === "watered").length);
  const openWaterTiles = terrain.filter((tt) => tt.type === "water").length;
  const water = analyzeWater(terrain);
  const healthPoints = computeHealthPoints(d, placements, openWaterTiles) + wateredTiles;
  const health = healthFromPoints(healthPoints);
  const discoveries = await byPlayer(t.Discovery, playerId);
  const returnedIds = new Set(discoveries.map((x) => x.animalId));
  const countInBiome = () => [...returnedIds].filter((id) => d.animal.get(id)?.biome === biomeId).length;
  let balance = balanceFromReturns(countInBiome());
  const newAnimals = [];
  const biomeAnimals = d.animals.filter((a) => a.biome === biomeId);
  for (const animal of biomeAnimals) {
    if (returnedIds.has(animal.id)) continue;
    if (meetsRequirements(animal, health, balance, counts, returnedIds, water)) {
      const disc = {
        id: `${playerId}:${animal.id}`,
        playerId,
        animalId: animal.id,
        biomeId,
        comfort: computeComfort(animal, counts),
        timesObserved: 0,
        firstObservedAt: Date.now(),
        whyReturned: whyReturnedText(animal, d)
      };
      await t.Discovery.put(disc);
      returnedIds.add(animal.id);
      balance = balanceFromReturns(countInBiome());
      newAnimals.push({ ...disc, animal });
      break;
    }
  }
  for (const disc of discoveries) {
    if (disc.biomeId !== biomeId) continue;
    const animal = d.animal.get(disc.animalId);
    if (!animal) continue;
    const comfort = computeComfort(animal, counts);
    if (comfort !== disc.comfort) await t.Discovery.patch(disc.id, { comfort });
  }
  const returnedCount = [...returnedIds].filter((id) => d.animal.get(id)?.biome === biomeId).length;
  const prior = await t.BiomeState.get(`${playerId}:${biomeId}`);
  await t.BiomeState.patch(`${playerId}:${biomeId}`, { health, balance, returnedCount });
  const biomeState = {
    ...prior || { id: `${playerId}:${biomeId}`, playerId, biomeId, unlocked: biomeId === "meadow" },
    health,
    balance,
    returnedCount
  };
  const unlockedBiomes = await checkUnlocks(playerId, { player: opts.player, freshState: biomeState });
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
async function seedStartingTerrain(playerId, biomeId) {
  const layout = STARTING_TERRAIN[biomeId];
  if (!layout) return;
  const t = db();
  for (const cell of layout) {
    const id = `${playerId}:${biomeId}:${cell.x}:${cell.y}`;
    if (await t.TerrainTile.get(id)) continue;
    await t.TerrainTile.put({ id, playerId, area: biomeId, x: cell.x, y: cell.y, type: cell.type, updatedAt: Date.now() });
  }
}
async function checkUnlocks(playerId, fresh = {}) {
  const t = db();
  const d = await defs();
  const player = fresh.player || await t.Player.get(playerId);
  const unlockedNow = [];
  const unlockedSet = new Set(player.unlockedBiomes || []);
  for (const biome of d.biomes) {
    if (!biome.unlock || unlockedSet.has(biome.id)) continue;
    const u = biome.unlock;
    const prereq = fresh.freshState?.biomeId === u.biome ? fresh.freshState : await t.BiomeState.get(`${playerId}:${u.biome}`);
    if (!prereq || !unlockedSet.has(u.biome)) continue;
    if ((prereq.health || 0) < (u.minHealth || 0)) continue;
    if ((prereq.returnedCount || 0) < (u.minAnimals || 0)) continue;
    if (u.minTotalAnimals) {
      const totalReturned = (await byPlayer(t.Discovery, playerId)).length;
      if (totalReturned < u.minTotalAnimals) continue;
    }
    if (u.requiresItem) {
      const crafted = player.craftedItems?.[u.requiresItem] || 0;
      const everCrafted = player.craftedEver?.[u.requiresItem] || 0;
      if (crafted <= 0 && everCrafted <= 0) continue;
    }
    if (u.requiresTool && (player.tools?.[u.requiresTool.id] || 1) < u.requiresTool.tier) continue;
    unlockedSet.add(biome.id);
    await t.Player.patch(playerId, { unlockedBiomes: [...unlockedSet] });
    await t.BiomeState.patch(`${playerId}:${biome.id}`, { unlocked: true });
    await seedStartingTerrain(playerId, biome.id);
    unlockedNow.push({ id: biome.id, name: biome.name });
  }
  return unlockedNow;
}
async function getOwnedChest(t, d, chestId, playerId) {
  const chest = await t.Chest.get(chestId);
  if (chest && chest.playerId === playerId) return chest;
  const placement = await t.Placement.get(chestId);
  if (placement && placement.playerId === playerId) {
    const def = d.object.get(placement.objectId);
    if (def?.isChest) {
      const healed = {
        id: chestId,
        playerId,
        area: placement.area,
        x: placement.x,
        y: placement.y,
        size: placement.objectId,
        capacity: def.chestCapacity || 60,
        contents: {}
      };
      await t.Chest.put(healed);
      return healed;
    }
  }
  return null;
}
async function consumeMaterials(player, materials) {
  const t = db();
  const chests = await byPlayer(t.Chest, player.id);
  for (const [resId, qty] of Object.entries(materials)) {
    const inInv = player.inventory?.[resId] || 0;
    const inChests = chests.reduce((sum, c) => sum + (c.contents?.[resId] || 0), 0);
    if (inInv + inChests < qty) {
      throw new GameError(`Not enough ${resId}: need ${qty}, have ${inInv + inChests} (basket + chests)`);
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
    if (remaining > 0) throw new GameError(`Not enough ${resId}`);
  }
  await t.Player.patch(player.id, { inventory });
  for (const chest of chests) {
    if (usedFrom.chests[chest.id]) {
      await t.Chest.patch(chest.id, { contents: chestContents.get(chest.id) });
    }
  }
  return { usedFrom, inventory };
}
async function snapshot(playerId) {
  const t = db();
  const d = await defs();
  let player = await t.Player.get(playerId);
  const areaBiome = d.biome.get(player?.area);
  if (player && (!areaBiome || !areaBiome.explorable)) {
    player = { ...player, area: "meadow", x: 10.5, y: 6.5 };
  }
  const [biomeStates, placements, chests, discoveries, nodeStates, terrain] = await Promise.all([
    byPlayer(t.BiomeState, playerId),
    byPlayer(t.Placement, playerId),
    byPlayer(t.Chest, playerId),
    byPlayer(t.Discovery, playerId),
    byPlayer(t.NodeState, playerId),
    byPlayer(t.TerrainTile, playerId)
  ]);
  return {
    player: sanitizePlayer(player),
    biomeStates,
    placements,
    chests,
    discoveries,
    nodeStates,
    terrain,
    serverTime: Date.now(),
    nodeRegenSeconds: NODE_REGEN_SECONDS,
    inventoryCapacity: inventoryCapacity(player)
  };
}
async function bodyOf(data) {
  const body = await data;
  if (!body || typeof body !== "object") throw new GameError("Request body required");
  return body;
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
var GameData = class extends PublicEndpoint {
  async get() {
    const d = await defs();
    return {
      biomes: d.biomes,
      animals: d.animals,
      resources: d.resources,
      recipes: d.recipes,
      habitatObjects: d.objects,
      tools: d.tools,
      nodeRegenSeconds: NODE_REGEN_SECONDS,
      appearanceOptions: {
        skins: SKIN_TONES,
        hair: HAIR_COLORS,
        outfits: OUTFIT_COLORS,
        hats: HAT_STYLES,
        hairstyles: HAIRSTYLES,
        bodies: BODY_TYPES
      }
    };
  }
};
var CreatePlayer = class extends PublicEndpoint {
  async post(data) {
    const { name, passcode, appearance } = await bodyOf(data);
    const cleanName = String(name || "").trim();
    if (cleanName.length < 2 || cleanName.length > 24) throw new GameError("Pick a name between 2 and 24 characters");
    const code = String(passcode || "");
    if (code.length < 4 || code.length > 32) throw new GameError("Pick a passcode of at least 4 characters");
    const playerId = slugId(cleanName);
    if (!playerId) throw new GameError("That name needs at least one letter or number");
    const existing = await db().Player.get(playerId);
    if (existing) throw new GameError("A save with that name already exists \u2014 try Load Game instead", 409);
    const created = await createPlayerRecords(playerId, cleanName, code, sanitizeAppearance(appearance));
    return { ok: true, playerId, state: freshSnapshot(created) };
  }
};
var DeletePlayer = class extends PublicEndpoint {
  async post(data) {
    const { name, passcode } = await bodyOf(data);
    const playerId = slugId(String(name || ""));
    const player = playerId ? await db().Player.get(playerId) : null;
    if (!player) throw new GameError("No save found with that name", 404);
    if (String(passcode || "") !== player.passcode) throw new GameError("That passcode doesn't match this save", 403);
    const t = db();
    let removed = 0;
    for (const table of [t.Placement, t.Chest, t.BiomeState, t.Discovery, t.NodeState, t.TerrainTile]) {
      for (const rec of await byPlayer(table, playerId)) {
        await table.delete(rec.id);
        removed++;
      }
    }
    await t.Player.delete(playerId);
    return { ok: true, deleted: playerId, recordsRemoved: removed + 1 };
  }
};
var LoginPlayer = class extends PublicEndpoint {
  async post(data) {
    const { name, passcode } = await bodyOf(data);
    const playerId = slugId(String(name || ""));
    const player = playerId ? await db().Player.get(playerId) : null;
    if (!player) throw new GameError("No save found with that name \u2014 try New Game", 404);
    if (String(passcode || "") !== player.passcode) throw new GameError("That passcode doesn't match this save", 403);
    const d = await defs();
    const areaBiome = d.biome.get(player.area);
    if (!areaBiome || !areaBiome.explorable) {
      await db().Player.patch(playerId, { area: "meadow", x: 10.5, y: 6.5 });
    }
    const now = Date.now();
    const prev = player.metrics || freshMetrics(player.createdAt || now);
    await db().Player.patch(playerId, { metrics: { ...prev, lastHeartbeatAt: 0, lastSeenAt: now } });
    return { ok: true, playerId, state: await snapshot(playerId) };
  }
};
var GameState = class extends PublicEndpoint {
  async get() {
    const playerId = String(this.getId() || "");
    await requirePlayer(playerId);
    return snapshot(playerId);
  }
};
var CollectResource = class extends PublicEndpoint {
  async post(data) {
    const { playerId, biomeId, nodeId, resourceId } = await bodyOf(data);
    const t = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const biome = d.biome.get(biomeId);
    if (!biome) throw new GameError(`Unknown biome: ${biomeId}`);
    if (!(player.unlockedBiomes || []).includes(biomeId)) throw new GameError(`${biome.name} is not unlocked yet`, 403);
    if (!(biome.resources || []).includes(resourceId)) throw new GameError(`${resourceId} is not found in ${biome.name}`);
    const resDef = d.resource.get(resourceId);
    if (!resDef) throw new GameError(`Unknown resource: ${resourceId}`);
    if (!nodeId || typeof nodeId !== "string") throw new GameError("nodeId required");
    const nodeKey = `${playerId}:${biomeId}:${nodeId}`;
    const nodeState = await t.NodeState.get(nodeKey);
    const now = Date.now();
    if (nodeState && now - nodeState.harvestedAt < NODE_REGEN_SECONDS * 1e3) {
      throw new GameError("This spot is still regrowing \u2014 come back soon", 409);
    }
    const capacity = inventoryCapacity(player);
    const carried = sumValues(player.inventory);
    if (carried >= capacity) throw new GameError("Your basket is full \u2014 store materials in a chest first", 409);
    const toolTier = player.tools?.[resDef.tool] || 1;
    const amount = Math.min(Math.max(1, toolTier), capacity - carried);
    const inventory = { ...player.inventory || {} };
    inventory[resourceId] = (inventory[resourceId] || 0) + amount;
    await t.Player.patch(playerId, { inventory });
    await t.NodeState.put({ id: nodeKey, playerId, harvestedAt: now });
    await bumpMetrics(player, { resourcesCollected: amount });
    return { ok: true, gained: { [resourceId]: amount }, inventory, nodeId, harvestedAt: now };
  }
};
var ChestTransfer = class extends PublicEndpoint {
  async post(data) {
    const { playerId, chestId, resourceId, qty, direction } = await bodyOf(data);
    const t = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const amount = posInt(qty, "qty");
    const chest = await getOwnedChest(t, d, chestId, playerId);
    if (!chest) throw new GameError("Chest not found", 404);
    const inventory = { ...player.inventory || {} };
    const contents = { ...chest.contents || {} };
    if (direction === "deposit") {
      if ((inventory[resourceId] || 0) < amount) throw new GameError(`Not enough ${resourceId} in your inventory`);
      if (sumValues(contents) + amount > chest.capacity) throw new GameError("That chest is full", 409);
      inventory[resourceId] -= amount;
      if (inventory[resourceId] <= 0) delete inventory[resourceId];
      contents[resourceId] = (contents[resourceId] || 0) + amount;
    } else if (direction === "withdraw") {
      if ((contents[resourceId] || 0) < amount) throw new GameError(`Not enough ${resourceId} in that chest`);
      if (sumValues(inventory) + amount > inventoryCapacity(player)) throw new GameError("Your basket is full", 409);
      contents[resourceId] -= amount;
      if (contents[resourceId] <= 0) delete contents[resourceId];
      inventory[resourceId] = (inventory[resourceId] || 0) + amount;
    } else {
      throw new GameError("direction must be 'deposit' or 'withdraw'");
    }
    await t.Player.patch(playerId, { inventory });
    await t.Chest.patch(chestId, { contents });
    return { ok: true, inventory, chest: { ...chest, contents } };
  }
};
var DiscardItem = class extends PublicEndpoint {
  async post(data) {
    const { playerId, kind, id, qty } = await bodyOf(data);
    const t = db();
    const { player } = await requirePlayer(playerId);
    const amount = posInt(qty, "qty");
    if (!id || typeof id !== "string") throw new GameError("id required");
    if (kind === "crafted") {
      const craftedItems = { ...player.craftedItems || {} };
      if ((craftedItems[id] || 0) < amount) throw new GameError("You do not have that many to throw away");
      craftedItems[id] -= amount;
      if (craftedItems[id] <= 0) delete craftedItems[id];
      await t.Player.patch(playerId, { craftedItems });
      return { ok: true, craftedItems };
    }
    const inventory = { ...player.inventory || {} };
    if ((inventory[id] || 0) < amount) throw new GameError("You do not have that many to throw away");
    inventory[id] -= amount;
    if (inventory[id] <= 0) delete inventory[id];
    await t.Player.patch(playerId, { inventory });
    return { ok: true, inventory };
  }
};
var CraftItem = class extends PublicEndpoint {
  async post(data) {
    const { playerId, recipeId } = await bodyOf(data);
    const t = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const recipe = d.recipe.get(recipeId);
    if (!recipe) throw new GameError(`Unknown recipe: ${recipeId}`);
    if (recipe.unlockBiome && !(player.unlockedBiomes || []).includes(recipe.unlockBiome)) {
      throw new GameError("This recipe unlocks with a biome you have not restored yet", 403);
    }
    if (recipe.requiresTool && (player.tools?.[recipe.requiresTool.id] || 1) < recipe.requiresTool.tier) {
      const tool = d.tool.get(recipe.requiresTool.id);
      throw new GameError(`Requires the upgraded ${tool?.name || recipe.requiresTool.id}`, 403);
    }
    if (recipe.once && (player.craftedEver?.[recipe.output.itemId] || 0) > 0) {
      throw new GameError(`You have already crafted the ${recipe.name} \u2014 it only needs to be made once.`, 409);
    }
    const { usedFrom, inventory } = await consumeMaterials(player, recipe.materials || {});
    const craftedItems = { ...player.craftedItems || {} };
    const craftedEver = { ...player.craftedEver || {} };
    craftedItems[recipe.output.itemId] = (craftedItems[recipe.output.itemId] || 0) + (recipe.output.qty || 1);
    craftedEver[recipe.output.itemId] = (craftedEver[recipe.output.itemId] || 0) + (recipe.output.qty || 1);
    await t.Player.patch(playerId, { craftedItems, craftedEver });
    const unlockedBiomes = await checkUnlocks(playerId, { player: { ...player, craftedItems, craftedEver } });
    const chests = await byPlayer(t.Chest, playerId);
    await bumpMetrics(player, { itemsCrafted: 1 });
    return { ok: true, crafted: recipe.output, craftedItems, inventory, chests, usedFrom, unlockedBiomes };
  }
};
var PlaceObject = class extends PublicEndpoint {
  async post(data) {
    const { playerId, objectId, area, x, y } = await bodyOf(data);
    const t = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const def = d.object.get(objectId);
    if (!def) throw new GameError(`Unknown object: ${objectId}`);
    if (def.placement === "none") throw new GameError(`${def.name} is a kit, not a placeable object`);
    if ((player.craftedItems?.[objectId] || 0) <= 0) throw new GameError(`You have no crafted ${def.name} to place`);
    const tx = Math.round(Number(x));
    const ty = Math.round(Number(y));
    if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 1 || ty < 1 || tx > 28 || ty > 18) {
      throw new GameError("That spot is out of reach");
    }
    const biome = d.biome.get(area);
    if (!biome) throw new GameError(`Unknown area: ${area}`);
    if (!(player.unlockedBiomes || []).includes(area)) throw new GameError(`${biome.name} is not unlocked yet`, 403);
    if (def.placement === "indoor") throw new GameError(`${def.name} cannot be placed out in the preserve`);
    if (!(def.biomes || []).includes(area)) throw new GameError(`${def.name} does not suit the ${biome.name} habitat`);
    if (def.requiresTool && (player.tools?.[def.requiresTool.id] || 1) < def.requiresTool.tier) {
      throw new GameError(`Placing ${def.name} requires an upgraded ${d.tool.get(def.requiresTool.id)?.name || def.requiresTool.id}`, 403);
    }
    const placements = await byPlayer(t.Placement, playerId);
    if (placements.some((p) => p.area === area && p.x === tx && p.y === ty)) {
      throw new GameError("That spot is already taken", 409);
    }
    const tileHere = await t.TerrainTile.get(`${playerId}:${area}:${tx}:${ty}`);
    if (tileHere && tileHere.playerId === playerId) {
      if (tileHere.type === "water") {
        if (!def.bridge) throw new GameError("That is open water \u2014 a wooden bridge can span it", 409);
      } else {
        throw new GameError("That soil bed is for planting \u2014 or clear it with the shovel", 409);
      }
    } else if (def.bridge) {
      throw new GameError("Bridges go over open water \u2014 flood a channel first", 409);
    }
    const craftedItems = { ...player.craftedItems || {} };
    craftedItems[objectId] -= 1;
    if (craftedItems[objectId] <= 0) delete craftedItems[objectId];
    await t.Player.patch(playerId, { craftedItems });
    const placementId = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const placement = { id: placementId, playerId, objectId, area, x: tx, y: ty, placedAt: Date.now() };
    await t.Placement.put(placement);
    if (def.isChest) {
      await t.Chest.put({
        id: placementId,
        playerId,
        area,
        x: tx,
        y: ty,
        size: objectId,
        capacity: def.chestCapacity || 60,
        contents: {}
      });
    }
    const recalc = await recalcBiome(playerId, area, {
      addPlacements: [placement],
      player: { ...player, craftedItems }
    });
    await bumpMetrics(player, { objectsPlaced: 1, animalsReturned: recalc.newAnimals?.length || 0 });
    return { ok: true, placement, craftedItems, ...recalc };
  }
};
var Plant = class extends PublicEndpoint {
  async post(data) {
    const { playerId, area, x, y, plantId } = await bodyOf(data);
    const t = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const biome = d.biome.get(area);
    if (!biome) throw new GameError(`Unknown area: ${area}`);
    if (!(player.unlockedBiomes || []).includes(area)) throw new GameError(`${biome.name} is not unlocked yet`, 403);
    const def = d.object.get(plantId);
    if (!def || !def.plantable) throw new GameError("That cannot be planted");
    if (!(def.biomes || []).includes(area)) throw new GameError(`${def.name} would not take root in the ${biome.name}`);
    const tx = Math.round(Number(x));
    const ty = Math.round(Number(y));
    const tileId = `${playerId}:${area}:${tx}:${ty}`;
    const bed = await t.TerrainTile.get(tileId);
    if (!bed || bed.playerId !== playerId || bed.type !== "watered") {
      throw new GameError("Plant into a watered soil bed \u2014 dig with the shovel, then water it");
    }
    const { usedFrom, inventory } = await consumeMaterials(player, def.plantCost || {});
    await t.TerrainTile.delete(tileId);
    const placementId = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const placement = {
      id: placementId,
      playerId,
      objectId: plantId,
      area,
      x: tx,
      y: ty,
      placedAt: Date.now(),
      plantedAt: Date.now()
    };
    await t.Placement.put(placement);
    const recalc = await recalcBiome(playerId, area, {
      addPlacements: [placement],
      removeTerrainIds: [tileId],
      player: { ...player, inventory }
    });
    await bumpMetrics(player, { plantsPlanted: 1, animalsReturned: recalc.newAnimals?.length || 0 });
    return { ok: true, placement, inventory, usedFrom, ...recalc };
  }
};
var UpdateAppearance = class extends PublicEndpoint {
  async post(data) {
    const { playerId, appearance } = await bodyOf(data);
    await requirePlayer(playerId);
    const clean = sanitizeAppearance(appearance);
    await db().Player.patch(playerId, { appearance: clean });
    return { ok: true, appearance: clean };
  }
};
var MoveObject = class extends PublicEndpoint {
  async post(data) {
    const { playerId, placementId, x, y } = await bodyOf(data);
    const t = db();
    await requirePlayer(playerId);
    const placement = await t.Placement.get(placementId);
    if (!placement || placement.playerId !== playerId) throw new GameError("Placement not found", 404);
    if (placement.objectId === "workbench") throw new GameError("The old workbench stays put");
    const tx = Math.round(Number(x));
    const ty = Math.round(Number(y));
    if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 1 || ty < 1 || tx > 28 || ty > 18) {
      throw new GameError("That spot is out of reach");
    }
    const placements = await byPlayer(t.Placement, playerId);
    if (placements.some((p) => p.id !== placementId && p.area === placement.area && p.x === tx && p.y === ty)) {
      throw new GameError("That spot is already taken", 409);
    }
    const d = await defs();
    const movingDef = d.object.get(placement.objectId);
    const tileHere = await t.TerrainTile.get(`${playerId}:${placement.area}:${tx}:${ty}`);
    if (tileHere && tileHere.playerId === playerId) {
      if (tileHere.type === "water") {
        if (!movingDef?.bridge) throw new GameError("That is open water \u2014 only a bridge can sit there", 409);
      } else {
        throw new GameError("That soil bed is for planting", 409);
      }
    } else if (movingDef?.bridge) {
      throw new GameError("Bridges go over open water", 409);
    }
    await t.Placement.patch(placementId, { x: tx, y: ty });
    const chest = await getOwnedChest(t, d, placementId, playerId);
    if (chest) await t.Chest.patch(placementId, { x: tx, y: ty });
    return { ok: true, placement: { ...placement, x: tx, y: ty } };
  }
};
var RemoveObject = class extends PublicEndpoint {
  async post(data) {
    const { playerId, placementId } = await bodyOf(data);
    const t = db();
    const { player } = await requirePlayer(playerId);
    const placement = await t.Placement.get(placementId);
    if (!placement || placement.playerId !== playerId) throw new GameError("Placement not found", 404);
    if (placement.objectId === "workbench") {
      throw new GameError("Your crafting station stays put \u2014 the preserve needs it");
    }
    const chest = await t.Chest.get(placementId);
    if (chest && sumValues(chest.contents) > 0) {
      throw new GameError("Empty the chest before picking it up", 409);
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
      const chests = (await byPlayer(t.Chest, playerId)).filter((c) => c.id !== placementId);
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
          throw new GameError("No room for the refunded materials \u2014 make space in your basket or a chest first", 409);
        }
      }
    } else {
      craftedItems[placement.objectId] = (craftedItems[placement.objectId] || 0) + 1;
    }
    if (chest) await t.Chest.delete(placementId);
    await t.Placement.delete(placementId);
    if (refunded) {
      await t.Player.patch(playerId, { inventory });
      for (const [cid, contents] of chestUpdates) await t.Chest.patch(cid, { contents });
    } else {
      await t.Player.patch(playerId, { craftedItems });
    }
    const recalc = placement.area !== "home" ? await recalcBiome(playerId, placement.area, {
      removeIds: [placementId],
      player: { ...player, craftedItems, inventory }
    }) : null;
    await bumpMetrics(player, { objectsRemoved: 1, animalsReturned: recalc?.newAnimals?.length || 0 });
    return { ok: true, removed: placementId, craftedItems, refunded, ...recalc || {} };
  }
};
var UpgradeTool = class extends PublicEndpoint {
  async post(data) {
    const { playerId, toolId } = await bodyOf(data);
    const t = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const toolDef = d.tool.get(toolId);
    if (!toolDef) throw new GameError(`Unknown tool: ${toolId}`);
    const currentTier = player.tools?.[toolId] || 1;
    const nextTier = (toolDef.tiers || []).find((tt) => tt.tier === currentTier + 1);
    if (!nextTier) throw new GameError(`${toolDef.name} is already fully upgraded`);
    if (nextTier.requires?.biome) {
      const bs = await t.BiomeState.get(`${playerId}:${nextTier.requires.biome}`);
      if ((bs?.health || 0) < (nextTier.requires.minHealth || 0)) {
        const biome = d.biome.get(nextTier.requires.biome);
        throw new GameError(
          `Restore ${biome?.name || nextTier.requires.biome} to ${nextTier.requires.minHealth}% health first`,
          403
        );
      }
    }
    const { usedFrom, inventory } = await consumeMaterials(player, nextTier.materials || {});
    const tools = { ...player.tools || {}, [toolId]: nextTier.tier };
    await t.Player.patch(playerId, { tools });
    const unlockedBiomes = await checkUnlocks(playerId, { player: { ...player, tools } });
    const chests = await byPlayer(t.Chest, playerId);
    await bumpMetrics(player, { toolsUpgraded: 1 });
    return { ok: true, tools, inventory, chests, usedFrom, unlockedBiomes, upgraded: { toolId, tier: nextTier.tier, name: nextTier.name } };
  }
};
var ObserveAnimal = class extends PublicEndpoint {
  async post(data) {
    const { playerId, animalId } = await bodyOf(data);
    const t = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const disc = await t.Discovery.get(`${playerId}:${animalId}`);
    if (!disc) throw new GameError("That animal has not returned yet", 404);
    const timesObserved = (disc.timesObserved || 0) + 1;
    await t.Discovery.patch(disc.id, { timesObserved });
    await bumpMetrics(player, { animalsObserved: 1 });
    return { ok: true, discovery: { ...disc, timesObserved }, animal: d.animal.get(animalId) };
  }
};
var Terraform = class extends PublicEndpoint {
  async post(data) {
    const { playerId, area, x, y, action } = await bodyOf(data);
    const t = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const biome = d.biome.get(area);
    if (!biome) throw new GameError("You can only shape the ground out in the preserve");
    if (!(player.unlockedBiomes || []).includes(area)) throw new GameError(`${biome.name} is not unlocked yet`, 403);
    const tx = Math.round(Number(x));
    const ty = Math.round(Number(y));
    if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 1 || ty < 1 || tx > 28 || ty > 18) {
      throw new GameError("That spot is out of reach");
    }
    const placements = await byPlayer(t.Placement, playerId);
    if (placements.some((p) => p.area === area && p.x === tx && p.y === ty)) {
      throw new GameError("Something is already placed there");
    }
    const tileId = `${playerId}:${area}:${tx}:${ty}`;
    const existing = await t.TerrainTile.get(tileId);
    let inventory = player.inventory || {};
    let tile = null;
    let removedId;
    if (action === "dig") {
      if ((player.tools?.shovel || 0) < 1) throw new GameError("You need your shovel for that");
      if (existing) throw new GameError("This ground is already prepared \u2014 water it, or clear it instead");
      tile = { id: tileId, playerId, area, x: tx, y: ty, type: "tilled", updatedAt: Date.now() };
      await t.TerrainTile.put(tile);
    } else if (action === "water") {
      if ((player.tools?.["watering-can"] || 0) < 1) throw new GameError("You need your watering can for that");
      if (!existing) throw new GameError("Prepare a soil bed with your shovel first");
      if (existing.type === "water") throw new GameError("This is already open water");
      const cost = 1;
      const newType = existing.type === "tilled" ? "watered" : "water";
      if (newType === "water" && biome.canFlood === false) {
        throw new GameError(`${biome.name} is too dry to flood \u2014 soil beds here can only be readied for planting.`);
      }
      const have = (inventory.water || 0) + (inventory["clean-water"] || 0);
      if (have < cost) throw new GameError(`You need ${cost} water for that \u2014 gather more first`);
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
      await t.Player.patch(playerId, { inventory });
      tile = { ...existing, type: newType, updatedAt: Date.now() };
      await t.TerrainTile.patch(tileId, { type: newType, updatedAt: Date.now() });
    } else if (action === "clear") {
      if (!existing) throw new GameError("Nothing to clear here");
      await t.TerrainTile.delete(tileId);
      removedId = tileId;
    } else {
      throw new GameError("action must be 'dig', 'water', or 'clear'");
    }
    const recalc = await recalcBiome(playerId, area, {
      addTerrain: tile ? [tile] : [],
      removeTerrainIds: removedId ? [removedId] : [],
      player: { ...player, inventory }
    });
    await bumpMetrics(player, { terraformActions: 1, animalsReturned: recalc.newAnimals?.length || 0 });
    return { ok: true, tile, removedId, inventory, ...recalc };
  }
};
var RecalcBiome = class extends PublicEndpoint {
  async post(data) {
    const { playerId, biomeId } = await bodyOf(data);
    await requirePlayer(playerId);
    return { ok: true, ...await recalcBiome(playerId, biomeId) };
  }
};
var SyncPlayer = class extends PublicEndpoint {
  async post(data) {
    const { playerId, x, y, area, tutorialStep } = await bodyOf(data);
    const t = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const patch = {};
    if (Number.isFinite(Number(x))) patch.x = Number(x);
    if (Number.isFinite(Number(y))) patch.y = Number(y);
    if (Number.isInteger(tutorialStep) && tutorialStep >= 0 && tutorialStep <= 99) {
      patch.tutorialStep = tutorialStep;
    }
    if (area) {
      const biome = d.biome.get(area);
      if (!biome) throw new GameError(`Unknown area: ${area}`);
      if (!(player.unlockedBiomes || []).includes(area)) {
        throw new GameError(`${biome.name} is not unlocked yet`, 403);
      }
      if (!biome.explorable) {
        throw new GameError(`${biome.name} is part of the preserve plan but not explorable yet`, 403);
      }
      patch.area = area;
      if (STARTING_TERRAIN[area]) {
        const hasTerrain = (await byPlayer(t.TerrainTile, playerId)).some((tt) => tt.area === area);
        if (!hasTerrain) {
          await seedStartingTerrain(playerId, area);
          await recalcBiome(playerId, area, { player });
        }
      }
    }
    await t.Player.patch(playerId, patch);
    return { ok: true, player: await t.Player.get(playerId) };
  }
};
var SESSION_GAP_MS = 30 * 60 * 1e3;
var MAX_BEAT_MS = 90 * 1e3;
var Heartbeat = class extends PublicEndpoint {
  async post(data) {
    const { playerId } = await bodyOf(data);
    const t = db();
    const { player } = await requirePlayer(playerId);
    const now = Date.now();
    const prev = player.metrics || freshMetrics(player.createdAt || now);
    const last = prev.lastHeartbeatAt || 0;
    const gap = now - last;
    let playSeconds = prev.playSeconds || 0;
    let sessions = prev.sessions || 0;
    if (last === 0 || gap > SESSION_GAP_MS) {
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
      sessions
    };
    await t.Player.patch(playerId, { metrics });
    return { ok: true, metrics: metricsView({ ...player, metrics }) };
  }
};
var Metrics = class extends PublicEndpoint {
  async get() {
    const t = db();
    const id = String(this.getId?.() || "").trim();
    if (id) {
      const player = await t.Player.get(id);
      if (!player) throw new GameError("No save found with that id", 404);
      const bm = await biomeMetrics(id, { images: true });
      const view = metricsView(player);
      return {
        player: {
          ...view,
          biomeSummary: bm.summary,
          activation: activationFlags(view, bm.summary, player),
          biomes: bm.biomes
        }
      };
    }
    const now = Date.now();
    const players = await allOf(t.Player);
    const allStates = await allOf(t.BiomeState);
    const d = await defs();
    const statesByPlayer = /* @__PURE__ */ new Map();
    for (const s of allStates) {
      const arr = statesByPlayer.get(s.playerId) || [];
      arr.push(s);
      statesByPlayer.set(s.playerId, arr);
    }
    const views = players.map((p) => {
      const view = metricsView(p);
      const biomeSummary = summarizeBiomes(statesByPlayer.get(p.id) || []);
      return { ...view, biomeSummary, activation: activationFlags(view, biomeSummary, p) };
    }).sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0) || b.playSeconds - a.playSeconds);
    const N = views.length || 1;
    const pct = (n) => Math.round(n / N * 100);
    const actionTotals = {};
    for (const v of views) {
      for (const [k, n] of Object.entries(v.counts)) actionTotals[k] = (actionTotals[k] || 0) + n;
    }
    const totalPlaySeconds = views.reduce((acc, v) => acc + v.playSeconds, 0);
    const totalSessions = views.reduce((acc, v) => acc + v.sessions, 0);
    const totalActions = views.reduce((acc, v) => acc + v.totalActions, 0);
    const audience = {
      activeLast24h: views.filter((v) => v.status === "active").length,
      activeLast7d: views.filter((v) => v.status === "active" || v.status === "recent").length,
      dormant: views.filter((v) => v.status === "dormant").length,
      newLast24h: views.filter((v) => now - v.createdAt <= DAY_MS).length,
      newLast7d: views.filter((v) => now - v.createdAt <= 7 * DAY_MS).length
    };
    const returningPlayers = views.filter((v) => v.sessions >= 2).length;
    const funnel = {
      created: views.length,
      collected: views.filter((v) => v.activation.collected).length,
      crafted: views.filter((v) => v.activation.crafted).length,
      placed: views.filter((v) => v.activation.placed).length,
      attractedAnimal: views.filter((v) => v.activation.attractedAnimal).length,
      unlockedSecondBiome: views.filter((v) => v.activation.unlockedSecondBiome).length
    };
    const funnelPct = {
      collected: pct(funnel.collected),
      crafted: pct(funnel.crafted),
      placed: pct(funnel.placed),
      attractedAnimal: pct(funnel.attractedAnimal),
      unlockedSecondBiome: pct(funnel.unlockedSecondBiome)
    };
    const areaTally = {};
    for (const v of views) if (v.currentArea) areaTally[v.currentArea] = (areaTally[v.currentArea] || 0) + 1;
    const mostPopularArea = Object.entries(areaTally).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const perBiome = /* @__PURE__ */ new Map();
    for (const s of allStates) {
      if (!s.unlocked) continue;
      const e = perBiome.get(s.biomeId) || { players: 0, healthSum: 0, returned: 0, fully: 0 };
      e.players++;
      e.healthSum += s.health || 0;
      e.returned += s.returnedCount || 0;
      if ((s.health || 0) >= 100) e.fully++;
      perBiome.set(s.biomeId, e);
    }
    const biomeBreakdown = d.biomes.map((b) => {
      const e = perBiome.get(b.id);
      return {
        biomeId: b.id,
        name: b.name,
        playersUnlocked: e?.players || 0,
        avgHealth: e?.players ? Math.round(e.healthSum / e.players) : 0,
        totalAnimalsReturned: e?.returned || 0,
        fullyRestored: e?.fully || 0
      };
    });
    const withBiomes = views.filter((v) => v.biomeSummary.biomesUnlocked > 0);
    const avgBiomeHealth = withBiomes.length ? Math.round(withBiomes.reduce((acc, v) => acc + v.biomeSummary.avgHealth, 0) / withBiomes.length) : 0;
    return {
      generatedAt: now,
      summary: {
        players: views.length,
        audience,
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
          biomesFullyRestored: views.reduce((acc, v) => acc + v.biomeSummary.biomesFullyRestored, 0),
          avgUnlockedBiomes: round1(views.reduce((acc, v) => acc + v.unlockedBiomes, 0) / N),
          mostPopularArea
        },
        funnel,
        funnelPct,
        actionTotals,
        biomeBreakdown
      },
      players: views
    };
  }
};
var BiomeSnapshot = class extends PublicEndpoint {
  async get() {
    const id = String(this.getId?.() || "").trim();
    if (!id) throw new GameError("Add a player id to the path: /BiomeSnapshot/<playerId>");
    await requirePlayer(id);
    const t = db();
    const d = await defs();
    const states = (await byPlayer(t.BiomeState, id)).filter((s) => s.unlocked);
    const placements = await byPlayer(t.Placement, id);
    const terrain = await byPlayer(t.TerrainTile, id);
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
var DEV_PLAYER = "bailey";
var DevTools = class extends PublicEndpoint {
  async post(data) {
    const { playerId, action, area, amount, value, resources } = await bodyOf(data);
    if (playerId !== DEV_PLAYER) throw new GameError("Dev tools are restricted to the developer save", 403);
    const t = db();
    const d = await defs();
    const { player } = await requirePlayer(playerId);
    const log = [];
    switch (action) {
      case "seed-water": {
        const ar = area || "wetland";
        for (const tt of (await byPlayer(t.TerrainTile, playerId)).filter((x) => x.area === ar)) {
          await t.TerrainTile.delete(tt.id);
        }
        await seedStartingTerrain(playerId, ar);
        await recalcBiome(playerId, ar, { player });
        log.push(`Reseeded starting terrain for ${ar}`);
        break;
      }
      case "clear-terrain": {
        const ar = area || player.area;
        let n = 0;
        for (const tt of (await byPlayer(t.TerrainTile, playerId)).filter((x) => x.area === ar)) {
          await t.TerrainTile.delete(tt.id);
          n++;
        }
        await recalcBiome(playerId, ar, { player });
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
        await t.Player.patch(playerId, { inventory });
        break;
      }
      case "max-tools": {
        const tools = { ...player.tools || {} };
        for (const tool of d.tools) {
          const top = Math.max(...tool.tiers.map((ti) => ti.tier));
          tools[tool.id] = top;
        }
        await t.Player.patch(playerId, { tools });
        log.push("All tools set to max tier");
        break;
      }
      case "unlock-all": {
        const ids = d.biomes.map((b) => b.id);
        await t.Player.patch(playerId, { unlockedBiomes: ids });
        for (const id of ids) await t.BiomeState.patch(`${playerId}:${id}`, { unlocked: true });
        log.push(`Unlocked all biomes (${ids.length})`);
        break;
      }
      case "set-health": {
        const ar = area || player.area;
        const h = Math.max(0, Math.min(100, Number(value) || 100));
        await t.BiomeState.patch(`${playerId}:${ar}`, { health: h });
        log.push(`Set ${ar} health to ${h}% (recomputes on next change)`);
        break;
      }
      default:
        throw new GameError(`Unknown dev action: ${action}`);
    }
    return { ok: true, log, state: await snapshot(playerId) };
  }
};
export {
  BiomeSnapshot,
  ChestTransfer,
  CollectResource,
  CraftItem,
  CreatePlayer,
  DeletePlayer,
  DevTools,
  DiscardItem,
  GameData,
  GameState,
  Heartbeat,
  LoginPlayer,
  Metrics,
  MoveObject,
  ObserveAnimal,
  PlaceObject,
  Plant,
  RecalcBiome,
  RemoveObject,
  SyncPlayer,
  Terraform,
  UpdateAppearance,
  UpgradeTool
};
