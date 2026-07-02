#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Okyo — Download real Pexels food photos for all 65 recipes
#
# Run ONCE from the repo root:
#   bash scripts/download-food-images.sh
#
# Then restart Expo with cache cleared:
#   cd apps/mobile && expo start -c
#
# Saves to apps/mobile/assets/food/recipes/*.png
# (React Native's native image decoders read magic bytes, not file extension,
#  so JPEG-content .png files render correctly on iOS and Android.)
#
# License: Pexels License — free for commercial use, no attribution required.
#   https://www.pexels.com/license/
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

DEST="apps/mobile/assets/food/recipes"
PASS=0
FAIL=0

download() {
  local id="$1"
  local recipe_id="$2"
  local url="https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=800"
  local out="${DEST}/${recipe_id}.png"

  if curl -fsSL --max-time 30 -o "$out" "$url" 2>/dev/null; then
    PASS=$((PASS+1))
    echo "  ✓  ${recipe_id}"
  else
    FAIL=$((FAIL+1))
    echo "  ✗  ${recipe_id} (Pexels ID ${id}) — placeholder kept"
  fi
}

echo "Downloading Pexels food images → ${DEST}/"
echo ""

# ── Breakfast ──────────────────────────────────────────────────────────────
download 6109498   scrambled-eggs-toast
download 4220141   cinnamon-banana-oats
download 9928336   shakshuka
download 9101568   belgian-waffles-berries
download 4062617   avocado-toast-poached-egg
download 29516115  greek-yogurt-parfait
download 170849    spinach-feta-omelet
download 2402506   huevos-rancheros
download 4623075   french-toast
download 5779423   breakfast-burrito
download 3957501   smoked-salmon-bagel
download 6133456   granola-yogurt-bowl

# ── Smoothies ──────────────────────────────────────────────────────────────
download 775032    berry-banana-smoothie

# ── High Protein ───────────────────────────────────────────────────────────
download 6249394   garlic-chicken-rice-bowl

# ── Bowls ──────────────────────────────────────────────────────────────────
download 6120238   crispy-tofu-power-bowl
download 11783317  beef-pho
download 1630495   bibimbap
download 30120288  teriyaki-chicken-bowl
download 4828104   poke-bowl
download 6823336   gyudon

# ── Pasta ──────────────────────────────────────────────────────────────────
download 7837671   creamy-tomato-rigatoni
download 11414     garlic-butter-spaghetti
download 1640777   orzo-pasta-salad
download 31779533  spaghetti-carbonara
download 2703468   fettuccine-alfredo
download 5848494   vegetable-lo-mein
download 10756648  pad-thai-shrimp
download 1815898   pad-see-ew

# ── Salads ─────────────────────────────────────────────────────────────────
download 6066051   crunchy-chickpea-salad
download 434258    greek-salad

# ── Burgers & Sandwiches ───────────────────────────────────────────────────
download 1639562   smash-cheeseburger
download 17430516  turkey-avocado-sandwich
download 30301906  caprese-sandwich
download 6275187   falafel-wrap
download 2983099   pulled-pork-sandwich
download 35983504  crispy-fish-tacos
download 8018079   chicken-shawarma
download 3071816   chiles-rellenos

# ── Pizza ──────────────────────────────────────────────────────────────────
download 14590497  margherita-flatbread-pizza

# ── Desserts ───────────────────────────────────────────────────────────────
download 6054918   chocolate-mug-cake
download 6327604   mango-sticky-rice

# ── Snacks ─────────────────────────────────────────────────────────────────
download 14941252  loaded-grilled-cheese

# ── Dinner Ideas ───────────────────────────────────────────────────────────
download 6210947   sheet-pan-lemon-chicken
download 8448339   carne-asada-tacos
download 19781599  thai-green-curry-chicken
download 29685054  butter-chicken
download 9134588   mezze-platter
download 4518581   mapo-tofu
download 2347311   beef-broccoli-stir-fry
download 675951    bulgogi-beef
download 2827263   thai-basil-chicken
download 15813481  lamb-tagine
download 6406460   mushroom-risotto
download 4224314   chicken-biryani
download 1516415   pan-seared-salmon-dill
download 3504872   eggplant-parmesan
download 1741078   red-curry-shrimp
download 1639561   chicken-piccata
download 3569706   spring-rolls-peanut
download 17223828  tandoori-chicken
download 19524049  seafood-paella
download 20408440  panang-curry-beef
download 5463886   miso-glazed-salmon
download 698308    chicken-souvlaki
download 12984979  tonkotsu-ramen

echo ""
echo "────────────────────────────────────"
echo "Done: ${PASS} downloaded, ${FAIL} failed (kept placeholder)"
echo ""
echo "Next step:"
echo "  cd apps/mobile && expo start -c"
echo "────────────────────────────────────"
