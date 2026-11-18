# Prompts for the AI menu photos (one per menu item), styled after tools/source-photo.webp.
# Run:  python3 menu-photo-prompts.py   → writes menu-photo-prompts.json (id → prompt)
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
menu = json.load(open(os.path.join(HERE, '..', 'data', 'menu.json')))

STYLE = ("Professional e-commerce food product photo, same style, lighting and branding as the reference image: "
         "pure white seamless background, soft studio light, soft natural shadow, front view slightly from above, "
         "sharp focus, fresh glossy ingredients with tiny water droplets, photorealistic, no text other than the label, "
         "no hands, no props, centred with space around it.")
LABEL = "an oval white sticker label on the front reading 'Navrasa — Fresh Bowls & More' with the green leaf logo exactly like the reference"

VESSEL = {
    'fruit-bowls': f"served in the same clear round plastic takeaway cup as the reference, {LABEL}, heaped with",
    'smoothie-bowls': f"served in the same clear round plastic takeaway cup as the reference, {LABEL}, a thick smooth smoothie base filling the cup, topped with",
    'smoothies': f"a tall clear plastic takeaway smoothie cup with a domed lid and a paper straw, {LABEL}, filled with",
    'juices': f"a tall clear plastic takeaway juice cup with a flat lid and a paper straw, {LABEL}, filled with",
    'salads': f"served in a clear round plastic takeaway salad bowl, {LABEL}, filled with",
    'breakfast': f"served in a clear plastic takeaway cup showing the layers through the side, {LABEL}, containing",
    'addons': f"a small clear round plastic dip container (no lid), {LABEL} small on the front, filled with",
}
DETAIL = {  # what the camera should see, per item
 'watermelon-fresh-bowl': 'bright red juicy watermelon cubes and a few mint leaves',
 'papaya-fresh-bowl': 'ripe orange papaya cubes, a lime wedge and mint leaves',
 'seasonal-mix-bowl': 'apple pieces, banana slices, green and black grapes, orange segments and pomegranate pearls',
 'tropical-fruit-bowl': 'pineapple chunks, mango cubes, banana slices, watermelon cubes and mint',
 'fruit-seed-bowl': 'banana slices, apple pieces, kiwi slices, pomegranate pearls, sprinkled with chia seeds and pumpkin and sunflower seeds',
 'mango-fruit-bowl': 'sweet ripe golden mango cubes and a sprig of mint',
 'apple-pomegranate-bowl': 'crisp red and green apple cubes mixed with lots of ruby pomegranate pearls',
 'banana-smoothie': 'a creamy pale-yellow banana smoothie, a banana slice on the rim',
 'banana-oats-smoothie': 'a creamy beige banana and oats smoothie with a sprinkle of oats on top',
 'mango-smoothie': 'a thick bright orange mango smoothie, a mango cube on the rim',
 'choco-banana-smoothie': 'a rich chocolate-brown cocoa banana smoothie with cocoa dusting on top',
 'strawberry-smoothie': 'a thick pink strawberry smoothie, a fresh strawberry on the rim',
 'pineapple-coconut-smoothie': 'a creamy pale-yellow pineapple coconut smoothie, a small pineapple wedge on the rim',
 'banana-peanut-butter-smoothie': 'a creamy tan banana peanut butter smoothie with a peanut butter drizzle inside the cup',
 'mango-banana-smoothie': 'a creamy golden mango banana smoothie',
 'apple-cinnamon-smoothie': 'a creamy light-brown apple cinnamon smoothie dusted with cinnamon, an apple slice on the rim',
 'dates-banana-smoothie': 'a creamy caramel-brown dates and banana smoothie, two dates beside the cup',
 'banana-crunch-bowl': 'yellow banana smoothie base topped with banana slices, crunchy granola clusters, chia seeds and a honey drizzle',
 'mango-tropical-bowl': 'bright orange mango smoothie base topped with mango cubes, pineapple chunks, coconut flakes and chia seeds',
 'choco-banana-bowl': 'chocolate-brown cocoa banana base topped with banana slices, granola and chocolate shavings',
 'peanut-butter-bowl': 'tan peanut butter banana base topped with banana slices, granola, mixed seeds and a peanut butter drizzle',
 'fruit-granola-bowl': 'purple berry smoothie base topped with strawberries, banana slices, kiwi slices, blueberries, granola and mint',
 'watermelon-juice': 'fresh bright red watermelon juice with ice, a small watermelon wedge on the rim',
 'mosambi-juice': 'fresh pale yellow-green sweet lime (mosambi) juice, a sweet lime slice on the rim',
 'pineapple-juice': 'fresh golden pineapple juice, a pineapple wedge on the rim',
 'orange-juice': 'fresh-squeezed bright orange juice, an orange slice on the rim',
 'papaya-smooth-juice': 'smooth orange papaya juice',
 'carrot-juice': 'fresh bright orange carrot juice, a small carrot beside the cup',
 'beetroot-juice': 'deep magenta-red beetroot juice, a beetroot slice beside the cup',
 'cucumber-mint-cooler': 'pale green cucumber mint cooler with ice, cucumber slices and mint leaves inside',
 'pomegranate-juice': 'deep ruby-red pomegranate juice, a few pomegranate pearls on top',
 'apple-juice': 'clear golden apple juice with ice, an apple slice on the rim',
 'mixed-fruit-juice': 'orange-coloured mixed fruit juice, an orange slice and mint on the rim',
 'garden-crunch-salad': 'crisp lettuce, cucumber, cherry tomatoes, grated carrot and capsicum strips with a light herb dressing',
 'chickpea-chaat-salad': 'boiled chickpeas with chopped onion, tomato, cucumber and coriander, sprinkled with chaat masala, a lime wedge',
 'paneer-power-salad': 'soft paneer cubes with lettuce, cucumber, red and green capsicum and cherry tomatoes',
 'sweet-corn-salad': 'golden sweet corn kernels with chopped capsicum, onion, tomato and coriander',
 'sprouts-veggie-salad': 'green moong sprouts with chopped onion, tomato, cucumber, coriander and a lime wedge',
 'quinoa-veggie-salad': 'fluffy quinoa with colourful diced bell peppers, cucumber and cherry tomatoes',
 'premium-paneer-salad': 'a generous portion of grilled golden paneer cubes on mixed greens with cherry tomatoes, bell peppers and seeds',
 'cucumber-corn-salad': 'cucumber slices and sweet corn with mint and a squeeze of lime',
 'banana-overnight-oats': 'creamy overnight oats layered with milk, topped with banana slices and chia seeds',
 'chocolate-overnight-oats': 'chocolate overnight oats, topped with banana slices and cocoa dusting',
 'fruit-yogurt-parfait': 'layers of thick white Greek yogurt, granola and strawberry, topped with strawberry and banana slices and a honey drizzle',
 'chia-fruit-pudding': 'creamy white chia seed pudding with a mango puree layer, topped with mango cubes and banana slices',
 'chickpea-power-bowl': 'chickpeas with cucumber, tomato, onion and coriander with lemon dressing',
 'paneer-veggie-bowl': 'sauteed golden paneer cubes with capsicum, onion and sweet corn, garnished with herbs',
 'mango-yogurt-parfait': 'layers of thick white Greek yogurt and bright mango, topped with mango cubes and granola',
 'extra-banana': 'fresh banana slices', 'extra-apple': 'fresh apple slices', 'pomegranate': 'ruby-red pomegranate pearls',
 'mixed-seeds': 'mixed pumpkin, sunflower and flax seeds', 'chia-seeds': 'black chia seeds', 'granola': 'golden crunchy granola clusters',
 'oats': 'rolled oats', 'peanut-butter': 'smooth creamy peanut butter', 'yogurt-dip': 'thick white yogurt dip with a mint leaf',
 'extra-paneer': 'soft fresh paneer cubes', 'chickpeas': 'boiled chickpeas',
}
SPECIAL = {
 'morning-fresh-combo': f"a combo of two Navrasa items side by side: a small clear takeaway fruit bowl cup with mixed fresh fruit and a tall clear juice cup of red watermelon juice with a straw, both with {LABEL}",
 'healthy-lunch-combo': f"a combo of two Navrasa items side by side: a clear takeaway salad bowl with a fresh garden salad and a tall clear cup of creamy banana smoothie with a straw, both with {LABEL}",
 'breakfast-combo': f"a combo of two Navrasa items side by side: a clear cup of banana overnight oats and a tall clear cup of creamy banana smoothie with a straw, both with {LABEL}",
 'share-enjoy-combo': f"four Navrasa items arranged together: two clear takeaway cups of mixed seasonal fruit bowls and two tall clear cups of banana smoothie with straws, all with {LABEL}",
 '5-day-fresh-fruit-plan': f"five different Navrasa fruit bowls in a neat row (watermelon, tropical, mango, seasonal mix, apple pomegranate), each in a clear takeaway cup with {LABEL}",
 '5-day-smoothie-plan': f"five Navrasa smoothies in a neat row (strawberry pink, mango orange, banana yellow, chocolate brown, pineapple coconut cream), each in a tall clear cup with a straw and {LABEL}",
 '5-day-salad-plan': f"five different Navrasa salads in a neat row (garden, paneer, sweet corn, quinoa, chickpea), each in a clear takeaway salad bowl with {LABEL}",
 '5-day-mixed-healthy-plan': f"five Navrasa items in a neat row: a fruit bowl, a mango smoothie, a garden salad, a cup of overnight oats and an orange juice, each with {LABEL}",
}
out, missing = {}, []
for b in menu['bowls']:
    if b['id'] in SPECIAL: subject = SPECIAL[b['id']]
    elif b['id'] in DETAIL: subject = f"{VESSEL[b['category']]} {DETAIL[b['id']]}"
    else: missing.append(b['id']); continue
    out[b['id']] = f"{b['name']} ({b['portion']}): {subject}. {STYLE}"
assert not missing, missing
json.dump(out, open(os.path.join(HERE, 'menu-photo-prompts.json'), 'w'), indent=1, ensure_ascii=False)
print(len(out), 'prompts written')
