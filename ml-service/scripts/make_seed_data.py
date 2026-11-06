"""Generates a labelled seed dataset of journal-style entries for the TF-IDF baseline.

IMPORTANT: this is *synthetic, template-based* data so the repo is runnable out of the box.
Because the vocabulary is limited, held-out accuracy on it is optimistic. For real quality,
retrain on real labelled text:   python train.py --data your_labelled.csv   (columns: text,label)
"""
import csv
import random
from pathlib import Path

random.seed(7)

POS_OPEN = [
    "Today was a really good day.", "I woke up feeling energised and hopeful.", "I'm so grateful for how things turned out.",
    "Honestly I feel lighter than I have in weeks.", "What a lovely, peaceful morning.", "I finally feel proud of myself.",
    "Things are looking up lately.", "I felt genuinely happy today.", "This week brought me a lot of joy.",
]
POS_BODY = [
    "I went for a long walk and the sunshine lifted my mood.", "My friends surprised me with dinner and we laughed all evening.",
    "I finished the project I'd been dreading and it went better than expected.", "I got great news from my family and I couldn't stop smiling.",
    "I slept well, ate a good breakfast and felt calm all day.", "Meditating this morning left me relaxed and focused.",
    "A colleague complimented my work and it made my whole week.", "I managed to stay on top of my to-do list and felt accomplished.",
    "I spent the afternoon reading in the park and felt completely content.", "Talking to my sister made me feel loved and supported.",
    "I cooked something new and it turned out delicious.", "The workout left me feeling strong and confident.",
]
POS_CLOSE = [
    "I'm excited about what comes next.", "I want to remember this feeling.", "Feeling thankful and at peace.",
    "I'm optimistic about tomorrow.", "Moments like this remind me life is good.", "I feel motivated to keep going.",
]

NEG_OPEN = [
    "Today was really hard.", "I woke up feeling anxious and drained.", "I can't shake this heavy feeling.",
    "Honestly I feel completely overwhelmed.", "Another sleepless night and I'm exhausted.", "I feel so alone right now.",
    "Everything feels like too much lately.", "I felt sad and low all day.", "This week has been miserable.",
]
NEG_BODY = [
    "I snapped at my friend and now I feel guilty and ashamed.", "I kept worrying about the exam and my chest felt tight all afternoon.",
    "My manager criticised my work in front of everyone and I felt humiliated.", "I couldn't concentrate and ended up crying in the bathroom.",
    "I argued with my family again and it left me angry and hurt.", "I skipped meals and stayed in bed because I had no energy.",
    "I feel like I'm failing at everything and falling behind.", "Nobody replied to my messages and I felt ignored and worthless.",
    "I'm terrified I'll disappoint everyone who depends on me.", "The stress is making it hard to breathe and sleep.",
    "I felt restless, irritable and frustrated for no clear reason.", "I missed home so much that I felt hopeless.",
]
NEG_CLOSE = [
    "I just want this feeling to go away.", "I don't know how much longer I can keep this up.", "I'm dreading tomorrow.",
    "I feel stuck and tired of pretending I'm fine.", "I wish I had someone to talk to.", "It's been a rough stretch.",
]

NEU_OPEN = [
    "Today was a pretty ordinary day.", "Nothing much happened today.", "I'm writing a quick update on my week.",
    "It was a regular Tuesday.", "Just a short note about today.", "Here's a summary of what I did.",
]
NEU_BODY = [
    "I went to class, had lunch in the cafeteria and came back to my room.", "I did laundry and cleaned my desk in the evening.",
    "I attended two meetings and answered some emails.", "I took the bus to the library and studied for a few hours.",
    "I watched an episode of a show and made pasta for dinner.", "I went to the market and bought vegetables and milk.",
    "The weather was cloudy and I stayed in most of the day.", "I called my parents for a few minutes and then did some reading.",
    "I updated my notes and planned the schedule for next week.", "I walked to the lab, ran the experiment and recorded the readings.",
    "I replied to a few messages and paid the electricity bill.", "I reorganised my files and backed up my laptop.",
]
NEU_CLOSE = [
    "That was about it.", "Nothing else to report.", "I'll see what tomorrow brings.",
    "Planning to do something similar tomorrow.", "That's all for now.", "Just noting it down.",
]

# Mixed entries: the *dominant* closing sentiment decides the label, so the model can't
# rely purely on the first sentence.
def build(op, body, cl, n_body):
    parts = [random.choice(op)] + random.sample(body, n_body) + [random.choice(cl)]
    return " ".join(parts)

rows = []
for _ in range(700):
    rows.append((build(POS_OPEN, POS_BODY, POS_CLOSE, random.randint(1, 3)), "positive"))
    rows.append((build(NEG_OPEN, NEG_BODY, NEG_CLOSE, random.randint(1, 3)), "negative"))
    rows.append((build(NEU_OPEN, NEU_BODY, NEU_CLOSE, random.randint(1, 3)), "neutral"))
# ~10% hard mixed examples: one opposite-sentiment sentence inside a majority-sentiment entry
for _ in range(150):
    rows.append((build(POS_OPEN, POS_BODY, POS_CLOSE, 2) + " " + random.choice(NEG_BODY), "positive"))
    rows.append((build(NEG_OPEN, NEG_BODY, NEG_CLOSE, 2) + " " + random.choice(POS_BODY), "negative"))


# --- Lexicon-driven short entries: widen vocabulary so the baseline generalises beyond the long templates ---
POS_ADJ = "happy glad joyful thrilled excited grateful proud relieved hopeful calm peaceful content cheerful delighted loved supported confident energised motivated wonderful amazing great fantastic lovely blessed optimistic satisfied inspired".split()
NEG_ADJ = "sad anxious worried stressed exhausted lonely hopeless angry frustrated upset miserable scared terrified guilty ashamed overwhelmed empty drained irritated hurt depressed nervous numb awful terrible horrible dreadful worthless stuck burnt-out".split()
NEU_ADJ = "okay fine average normal usual regular busy quiet routine standard typical".split()
POS_EVT = ["a chat with my best friend", "the interview", "my birthday dinner", "the trip with my family", "finishing my exam", "the offer letter", "a long walk outside", "the team meeting", "my morning run", "calling my mom", "the presentation", "winning the match"]
NEG_EVT = ["the exam", "my argument with a friend", "the deadline", "the rejection email", "being alone all weekend", "the meeting with my manager", "my results", "the fight at home", "another sleepless night", "the interview", "the news today", "falling behind in class"]
NEU_EVT = ["the lecture", "my commute", "the grocery run", "lab work", "the laundry", "my afternoon classes", "the weekly meeting", "cooking dinner", "an errand", "the bus ride"]
POS_T = ["I feel so {a} after {e}.", "{E} went really well and I'm {a}.", "I'm {a} and {a2} about {e}.", "Had {e} today, it left me feeling {a}.", "{E} made me feel {a}, I can't stop smiling.", "Honestly I'm just {a} today."]
NEG_T = ["I feel so {a} after {e}.", "{E} went badly and I'm {a}.", "I'm {a} and {a2} about {e}.", "Had {e} today, it left me feeling {a}.", "{E} made me feel {a}, I can't stop crying.", "Honestly I'm just {a} today."]
NEU_T = ["Had {e} today, it was {a}.", "{E} was {a}, nothing special.", "I did {e} and it was a {a} day.", "Just {e} today, pretty {a}."]
def lex(T, ADJ, EVT):
    t = random.choice(T); e = random.choice(EVT)
    return t.format(a=random.choice(ADJ), a2=random.choice(ADJ), e=e, E=e[0].upper() + e[1:])
for _ in range(500):
    rows.append((lex(POS_T, POS_ADJ, POS_EVT) + " " + lex(POS_T, POS_ADJ, POS_EVT), "positive"))
    rows.append((lex(NEG_T, NEG_ADJ, NEG_EVT) + " " + lex(NEG_T, NEG_ADJ, NEG_EVT), "negative"))
    rows.append((lex(NEU_T, NEU_ADJ, NEU_EVT), "neutral"))
    rows.append((lex(POS_T, POS_ADJ, POS_EVT), "positive"))
    rows.append((lex(NEG_T, NEG_ADJ, NEG_EVT), "negative"))

random.shuffle(rows)
out = Path(__file__).resolve().parent.parent / "data" / "seed_journal_sentiment.csv"
with out.open("w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["text", "label"])
    w.writerows(rows)
print(f"wrote {len(rows)} rows -> {out}")
