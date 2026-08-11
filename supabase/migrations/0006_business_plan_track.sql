-- Champio — migration 0006: BUSINESS PLAN TRACK CONTENT
-- Paste into Supabase -> SQL Editor -> Run. Idempotent; safe to re-run.
--
-- Five modules with quiz gates, in the order a team actually works:
--   1. Business Model Canvas   — frame the whole business on one page
--   2. Problem to Idea         — find a real problem, derive a solution from it
--   3. Marketing Analysis      — size it, position it, know the competition
--   4. Financial Projection    — prove it can make money
--   5. Presentation & Pitching — make judges believe it
--
-- Content teaches standard, publicly documented frameworks (Osterwalder's BMC and
-- Value Proposition Canvas, the Design Council double diamond, Doblin's Ten Types
-- of Innovation, SWOT, STP, the 7P marketing mix, TAM/SAM/SOM, NPV/IRR/payback).
-- Written for Indonesian BPC context. Review and adjust the voice before launch.
--
-- Markdown bodies use dollar-quoting ($md$ … $md$) rather than escaped single
-- quotes — the content is full of apostrophes and doubling every one of them is
-- how a seed migration acquires silent typos.
--
-- Answers live in `answer_key_json`, whose SELECT privilege is revoked from
-- anon/authenticated in migration 0002. Scoring happens server-side.

-- ============================================================================
-- MODULE 1 — Business Model Canvas
-- ============================================================================

insert into public.learning_modules
  (id, track_id, order_index, title, est_minutes, is_draft, content_md)
values (
  'b1000000-0000-4000-8000-000000000001',
  '22222222-2222-4222-8222-222222222222',
  1,
  'Business Model Canvas',
  25,
  false,
  $md$
## Why this comes first

Most teams lose a business plan competition long before the judges see their
financials. They lose because the judges cannot answer a basic question after
five slides: *what is this business, exactly?*

The Business Model Canvas fixes that. It is a method for explaining a business
idea **simply but in detail, on a single page**. Before you write a proposal,
before you build a deck, you should be able to fill this page. If you cannot, the
idea is not ready — and that is useful to discover in week one rather than the
night before submission.

## Where BMC sits in a competition

Most Indonesian BPCs run through the same stages:

```
BMC  →  Proposal  →  Presentation  →  (sometimes) Prototype
```

The canvas is the foundation. The proposal is the canvas expanded into argument
and evidence. The presentation is the proposal compressed into a story. Get the
canvas wrong and every later stage inherits the mistake.

It also helps to know **what kind of competition you have entered**, because it
changes what judges reward:

| Dimension | Options | What it changes |
|---|---|---|
| Scale | National, International | Language, benchmark quality, source expectations |
| Focus | Pemula (idea stage), Berjalan (running), Start-up, Fundraising | How much traction evidence you need |
| Organizer | University, Company, NGO | University → academic rigour; Company → commercial fit; NGO → impact |

A *pemula* category rewards a well-reasoned idea. A *fundraising* category will
not forgive missing unit economics. Read the guidebook before you decide how much
of your effort goes where.

## The nine blocks

```diagram
business-model-canvas
```

**Customer Segments — for whom?**
Who is this product built for? Be specific enough that you could go and find ten
of them tomorrow. "Everyone who eats" is not a segment. This is:

> Ibu rumah tangga, 22–40 years old, Bandung, middle to upper income.

If you have two sides to your business (donors and recipients, drivers and
riders), you have two segments and both need describing.

**Value Proposition — why you?**
The specific reason this segment would choose you over what they do today. Not a
feature list — the *reason to switch*. "Ramah lingkungan" and "design unik" are
starting points; the strong version says what the customer gains that they cannot
get elsewhere.

**Channels — how do they reach it?**
The route from your product to your customer: social media, offline store,
consignment in a mall, an app, a marketplace. Include how customers *discover*
you, not only how they receive the product.

**Customer Relationships — how do you keep them?**
Discount, end-of-year promo, email newsletter, membership, community campaign.
Acquisition is expensive; this block is about not having to pay it twice.

**Revenue Streams — where does the money come from?**
Product sales, subscription, commission, partnership, a percentage of transaction
value. Name the mechanism, not just the amount.

**Key Activities — what must you do?**
The work that has to happen for the business to run: product design, production,
partnership with pengrajin, marketing, distribution, app development.

**Key Resources — what do you need?**
Raw materials, people, equipment, capital, a developer, a licence.

**Key Partners — who do you need?**
Pengrajin, pemerintah desa, kurir, tukang jahit, PKK, a government body, a
philanthropic institution, a community. Partners are how a student team does
things it has no capital to do alone — use this block properly.

**Cost Structure — where does money go?**
Split fixed (hosting, maintenance, R&D, salaries) from variable (raw materials,
per-unit production, commission). This split matters again in the financial
module, so get it right here.

## Fill it in this order

Do not fill the canvas left to right. Fill it in the order the logic actually
flows:

1. **Customer Segments** — everything else depends on who
2. **Value Proposition** — what you offer them
3. **Channels** — how it reaches them
4. **Customer Relationships** — how you keep them
5. **Revenue Streams** — what you earn
6. **Key Activities** — what you must do to deliver
7. **Key Resources** — what that requires
8. **Key Partners** — who supplies what you lack
9. **Cost Structure** — what it all costs

Notice the shape: the right side is the customer, the left side is the machine
that serves them, and the bottom is the money. If your left side has nothing to
do with your right side, the canvas is telling you something.

## The mistake almost every team makes

**A canvas is a design tool, not a presentation tool.**

Do not put the full nine-box canvas on a pitch slide. It is dense, unreadable from
the back of a room, and it forces judges to do the work of finding your argument.
Use the canvas to *think*. Then present the conclusions it produced.

## Two more things judges notice

- **Consistency.** If Key Partners lists a courier but Cost Structure has no
  delivery cost, one of those blocks is wrong.
- **Specificity.** "Sosial media" as a channel tells a judge nothing. "Instagram
  and TikTok targeting Bandung, with paid promotion in month 3" tells them you
  have thought about it.

## Before you move on

Fill a complete canvas for your idea. Then hand it to someone outside your team
and ask them to explain your business back to you. Whatever they get wrong is the
block you need to rewrite.
$md$
)
on conflict (track_id, order_index) do update
  set title = excluded.title,
      content_md = excluded.content_md,
      est_minutes = excluded.est_minutes,
      is_draft = excluded.is_draft;

insert into public.quizzes (id, module_id, pass_threshold, questions_json, answer_key_json)
values (
  'c1000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  70,
  $json$  [
      {
          "id": "q1",
          "question": "In which order should you fill the Business Model Canvas?",
          "options": [
              "Customer Segments first, then Value Proposition, ending with Cost Structure",
              "Left to right, starting with Key Partners",
              "Revenue Streams first, since money matters most to judges",
              "Any order — the blocks are independent"
          ]
      },
      {
          "id": "q2",
          "question": "A team writes their Customer Segment as \"anyone who wants healthy food\". What is wrong with it?",
          "options": [
              "Nothing — a wide segment shows a large market",
              "It is not specific enough to find or reach real customers",
              "It is too specific and limits growth",
              "Segments should describe the product, not the customer"
          ]
      },
      {
          "id": "q3",
          "question": "Why should you not put the full nine-box canvas on a pitch slide?",
          "options": [
              "Judges are not familiar with the BMC framework",
              "It reveals confidential business information",
              "The canvas is a design tool for thinking, not a presentation tool",
              "Competition rules usually forbid it"
          ]
      },
      {
          "id": "q4",
          "question": "Your Key Partners block lists a courier service, but your Cost Structure has no delivery cost. What does this signal to a judge?",
          "options": [
              "Efficient cost management",
              "The partner is providing delivery for free",
              "Nothing; the blocks are unrelated",
              "An internal inconsistency — one of the two blocks is wrong"
          ]
      },
      {
          "id": "q5",
          "question": "You have entered a competition in the \"fundraising\" category. Compared with a \"pemula\" category, what should you strengthen most?",
          "options": [
              "Unit economics and evidence of traction",
              "The visual design of the deck",
              "The number of team members listed",
              "The length of the written proposal"
          ]
      }
  ]$json$::jsonb,
  $json$  [
      {
          "id": "q1",
          "correct_index": 0,
          "explanation": "The canvas follows the logic of the business: who you serve, what you offer them, how it reaches them, what you earn, then the machine and cost required to deliver it. Filling it left to right means guessing at partners before you know the customer."
      },
      {
          "id": "q2",
          "correct_index": 1,
          "explanation": "A useful segment is specific enough that you could go and find ten of those people tomorrow. Age, location, income level and situation turn a vague market into someone you can actually interview and sell to."
      },
      {
          "id": "q3",
          "correct_index": 2,
          "explanation": "The canvas is dense by design — it is where you do your thinking. On a slide it is unreadable from the back of a room and forces judges to hunt for your argument. Present the conclusions the canvas produced instead."
      },
      {
          "id": "q4",
          "correct_index": 3,
          "explanation": "Judges read across blocks. A partner with no matching cost, or a channel with no matching activity, tells them the canvas was filled in box by box rather than thought through as one system."
      },
      {
          "id": "q5",
          "correct_index": 0,
          "explanation": "Category changes what is rewarded. A pemula category can accept a well-reasoned idea; a fundraising category is judged as an investment case and will not forgive missing unit economics or traction evidence."
      }
  ]$json$::jsonb
)
on conflict (module_id) do update
  set questions_json = excluded.questions_json,
      answer_key_json = excluded.answer_key_json,
      pass_threshold = excluded.pass_threshold;

-- ============================================================================
-- MODULE 2 — Problem to Idea
-- ============================================================================

insert into public.learning_modules
  (id, track_id, order_index, title, est_minutes, is_draft, content_md)
values (
  'b1000000-0000-4000-8000-000000000002',
  '22222222-2222-4222-8222-222222222222',
  2,
  'Problem to Idea',
  30,
  false,
  $md$
## The rule

**Find the main and most urgent problem around you. Then formulate the most
realistic and impactful solution that can actually be sold.**

Both halves matter. A real problem with an unsellable solution is a research
paper. A sellable solution to a problem nobody has is the most common way student
teams lose — and it is almost always because they started from the idea.

Start from the problem. Always.

## Where to find problems

Four practical methods, in rough order of how much effort they cost:

- **Refleksi** — what frustrates you, your family, your kos, your campus? You are
  a user of many broken systems. Write them down.
- **Ngobrol** — talk to people outside your circle. A warung owner, a farmer, a
  nurse, your mother. Ask what wastes their time.
- **Observasi** — go and watch. People are unreliable narrators of their own
  behaviour; what they *do* differs from what they *say*.
- **Datang ke event start-up** — founders and investors talk openly about problems
  they see and cannot yet solve.

And **ATM** — *Amati, Tiru, Modifikasi*. Observe what works elsewhere, adapt it to
a context it has not reached. This is not cheating; most successful businesses in
Indonesia are a proven model applied to a new segment or region. What matters is
that the *modification* is genuinely yours and genuinely fits the local problem.

## The innovation sweet spot

A solution has to sit in the middle of three circles:

- **Desirability** — do people actually want it? (user-centric design)
- **Feasibility** — can it realistically be built and run?
- **Viability** — can it sustain itself as a business?

Student proposals usually fail on viability (a lovely idea with no revenue model)
or feasibility (an app requiring an engineering team you do not have). Judges test
all three. Check your idea against each before you commit a month to it.

## Design thinking, in the shape it is actually used

```
UNDERSTAND          CREATE              DELIVER
diverge → converge  diverge → converge  converge
Empathy → Define    Ideate → Prototype  Test
ends in INSIGHT     ends in IDEAS       ends in REALITY
```

The important discipline is the alternation. You **diverge** — collect many
observations, generate many ideas — then you **converge** — cut to one insight,
one idea. Teams that never diverge produce obvious solutions. Teams that never
converge produce a deck with six half-ideas and no recommendation.

## Three techniques for empathising

| Technique | What it gives you | How |
|---|---|---|
| **Engage** | Unique perspectives from stakeholders | Interviews, surveys, FGDs |
| **Observe** | What your five senses tell you about the problem space | *A Day In the Life Of* (DILO) |
| **Immerse** | The need experienced first-hand | Job shadowing — do the work yourself |

Interviews alone are the weakest evidence, because people rationalise. A team that
has spent a day behind a warung counter will out-argue a team with a 200-response
Google Form, every time.

## The reasoning chain from customer to solution

This is the single most useful structure in this module. Work left to right:

```
Target Customer
   → Their Goal            (is it important to them?)
   → Jobs to Be Done       (what are they trying to get done?)
   → Existing Solution     (what do they use today?)
   → Pains / Problems      (is it actually painful?)
   → Gains / Wants         (what do they really expect?)
   → DESIGN CHALLENGE      ("How might we help X who ... so that ...?")
   → Potential Solution + Value Proposition
```

A worked example:

> **Customer:** millennial culinary entrepreneurs with a higher-education background
> **Goal:** grow the business to 100 outlets
> **Job to be done:** analyse sales
> **Existing solution:** recap and process it in spreadsheets
> **Pains:** volume of data, formula errors, mistakes, takes a long time
> **Gains:** sales insight, product trend projection
> **Design challenge:** How might we help culinary entrepreneurs who struggle to
> process large volumes of data in a short time to analyse sales for business
> development?
> **Solution:** a POS app with financial reporting
> **Value proposition:** insight generated directly from field transaction data

Notice that the value proposition is *derived*, not invented. That is the whole
point of the chain. When a judge asks "why this solution?", you walk them back up
it.

## Value Proposition Canvas

The chain above has a formal tool. Two halves that must match:

**Customer Profile** — *Customer Jobs*, *Pains*, *Gains*
**Value Map** — *Products & Services*, *Pain Relievers*, *Gain Creators*

The test is **fit**: every pain reliever should point at a named pain, every gain
creator at a named gain. A feature that relieves nothing is a feature you built
because it was interesting.

## Ten types of innovation

Innovation is not only a new product. Doblin's framework gives you ten places to
innovate — useful when your product itself is hard to differentiate:

**Configuration** — Profit Model, Network, Structure, Process
**Offering** — Product Performance, Product System
**Experience** — Service, Channel, Brand, Customer Engagement

- *Profit model:* The New York Times moved from advertising to digital subscriptions
- *Network:* Ford controlled its whole supply chain — vertical integration
- *Process:* McDonald's let franchisees invent menu items, which produced the Egg McMuffin
- *Product system:* Apple's products work together, creating value beyond each one
- *Channel:* Nespresso locks in customers through its club and pod sales
- *Brand:* Patagonia's environmental activism gives it a position competitors cannot copy

The strongest entries usually combine two or three types. A product-only
innovation is the easiest for a competitor to copy.

## Themes that travel well in Indonesian BPCs

Kesehatan fisik · kesehatan mental · pertanian · teknologi · pendidikan ·
finansial · sampah dan lingkungan.

Cross-cutting angles judges respond to right now: **AI**, **apps**, and **ESG**.
Mapping your idea to a **Sustainable Development Goal** is often an explicit
scoring criterion — check the guidebook, and if it is there, name the specific
goal rather than gesturing at sustainability.

## Before you move on

Write your design challenge as one sentence in the form *"How might we help
\[specific customer] who \[specific pain] so that \[specific gain]?"* If you cannot
fill all three slots with something concrete, go back and do more empathising.
$md$
)
on conflict (track_id, order_index) do update
  set title = excluded.title,
      content_md = excluded.content_md,
      est_minutes = excluded.est_minutes,
      is_draft = excluded.is_draft;

insert into public.quizzes (id, module_id, pass_threshold, questions_json, answer_key_json)
values (
  'c1000000-0000-4000-8000-000000000002',
  'b1000000-0000-4000-8000-000000000002',
  70,
  $json$  [
      {
          "id": "q1",
          "question": "Which is the most common reason student business plans fail at the idea stage?",
          "options": [
              "The problem chosen was too specific",
              "The team started from a solution and looked for a problem afterwards",
              "The team interviewed too many people",
              "The idea was adapted from an existing business model"
          ]
      },
      {
          "id": "q2",
          "question": "An idea that people clearly want and that you could realistically build, but which has no way to sustain revenue, is failing which test?",
          "options": [
              "Desirability",
              "Feasibility",
              "Viability",
              "Originality"
          ]
      },
      {
          "id": "q3",
          "question": "In the customer-to-solution chain, where does the value proposition come from?",
          "options": [
              "It is decided at the start and the chain justifies it",
              "It is copied from the closest competitor",
              "It comes from whichever feature is most technically impressive",
              "It is derived at the end, from the pains and gains identified earlier"
          ]
      },
      {
          "id": "q4",
          "question": "Your team has 200 survey responses. Another team spent a day working behind a warung counter. Why does the second team often argue more convincingly?",
          "options": [
              "Immersion reveals what people actually do, which often differs from what they say",
              "Surveys are not accepted as evidence in competitions",
              "A larger sample size is always weaker evidence",
              "Judges prefer qualitative data in every case"
          ]
      },
      {
          "id": "q5",
          "question": "Your product is easy for a competitor to copy. According to the ten types of innovation, what is the most useful response?",
          "options": [
              "Add more features to the product",
              "Combine innovation in other types, such as profit model, channel or brand",
              "Lower the price below the competitor",
              "Keep the product secret until launch"
          ]
      }
  ]$json$::jsonb,
  $json$  [
      {
          "id": "q1",
          "correct_index": 1,
          "explanation": "Starting from a solution produces a sellable answer to a question nobody asked. The discipline is to find the main and most urgent problem first, then derive a solution that is both realistic and actually sellable."
      },
      {
          "id": "q2",
          "correct_index": 2,
          "explanation": "Viability is the business-sustainability circle. Student proposals most often fail here (a lovely idea with no revenue model) or on feasibility (an app needing an engineering team the team does not have)."
      },
      {
          "id": "q3",
          "correct_index": 3,
          "explanation": "The chain runs customer → goal → jobs → existing solution → pains and gains → design challenge → solution and value proposition. Deriving it means that when a judge asks \"why this solution?\", you can walk them back up the chain."
      },
      {
          "id": "q4",
          "correct_index": 0,
          "explanation": "People rationalise when asked about their own behaviour. Immersion and observation surface what actually happens, which is why a day of job shadowing frequently beats a large survey in a QnA."
      },
      {
          "id": "q5",
          "correct_index": 1,
          "explanation": "A product-only innovation is the easiest thing for a competitor to copy. The strongest entries combine two or three types — profit model, network, channel, brand — which is much harder to replicate."
      }
  ]$json$::jsonb
)
on conflict (module_id) do update
  set questions_json = excluded.questions_json,
      answer_key_json = excluded.answer_key_json,
      pass_threshold = excluded.pass_threshold;

-- ============================================================================
-- MODULE 3 — Marketing Analysis
-- ============================================================================

insert into public.learning_modules
  (id, track_id, order_index, title, est_minutes, is_draft, content_md)
values (
  'b1000000-0000-4000-8000-000000000003',
  '22222222-2222-4222-8222-222222222222',
  3,
  'Marketing Analysis',
  30,
  false,
  $md$
## What this section has to prove

Three things, and judges score them separately:

1. The market is **big enough** to be worth entering
2. You know **exactly who** you are selling to first
3. You know **who else** is already there and why you win

Most teams do only the first, with one enormous number, and lose marks on the
other two.

## Market sizing: TAM, SAM, SOM

Three nested circles.

| | Meaning |
|---|---|
| **TAM** — Total Addressable Market | The whole opportunity if you captured 100% of the market |
| **SAM** — Serviceable Available Market | The portion of TAM you can realistically serve, given your capabilities |
| **SOM** — Serviceable & Obtainable Market | The portion of SAM you can realistically capture, given the challenges |

A worked example, for a business with two sides:

```
B2B   TAM 3.6M Indonesian grocery stores
    → SAM 75K   grocery stores in Jabodetabek
    → SOM 7.5K  obtainable, 10% of SAM

B2C   TAM 68M  families in Indonesia
    → SAM 3M   potential families in Jabodetabek
    → SOM 300K obtainable, 10% of SAM
```

Two things make this credible, and both are things teams skip:

- **Every step down is justified.** Why Jabodetabek? Because that is where your
  couriers operate. Why 10%? Because of a named constraint — capacity,
  competition, budget.
- **The number connects to your revenue.** If SOM is 7,500 stores and your
  projection assumes 40,000 customers in year two, a judge has just found the
  hole in your model. Your financials must be built *from* your SOM, not
  independently of it.

**The most common mistake:** presenting a huge TAM and stopping. "The Indonesian
F&B market is worth IDR 1,500 trillion" tells a judge nothing about your business
and signals you have not thought past the headline.

## SWOT

A four-quadrant brainstorm of **Strengths**, **Weaknesses**, **Opportunities** and
**Threats**. Strengths and weaknesses are internal; opportunities and threats are
external.

The whole value of a SWOT sits in the weaknesses quadrant, and it is the one every
team fudges. **It is extremely important to be honest here.** A weakness section
saying "we are still developing our marketing" is worthless. A real one:

> Limited market — the partner stores available in the app are still few and
> not updated.
> Less consistent — buyers sometimes receive ingredients that are not fresh.
> Not updated — prices in the app do not match the market, so change is often
> wrong.

That is a team that has actually used its own product. Judges reward it, because
a team that can see its own weaknesses is a team that can fix them. And in QnA,
naming your weakness first removes the question a judge was about to ask.

External threats worth considering: cybersecurity and data risk, dependency on
technology or a single supplier, market saturation as competitors copy you,
regulatory change.

## STP: Segmentation, Targeting, Positioning

The bridge from a market number to an actual go-to-market plan.

1. **Market Segmentation** — identify the basis for segmenting, then describe the
   important characteristics of each segment
2. **Market Targeting** — evaluate the potential and commercial attractiveness of
   each segment, then select one or more
3. **Product Positioning** — develop detailed positioning for the chosen segments
   and a marketing mix for each

The step teams skip is **targeting**. Choosing a beachhead segment and saying why
you chose it is a strategic decision. Serving everyone at once is not a strategy
and reads as indecision.

## Persona analysis

Semi-fictional profiles of your ideal customers, built from real research —
typically three to seven. Each persona is described by **motivation**,
**behaviour**, **order frequency** and **needs**.

For a grocery-delivery business, personas might be: young mother, college student,
merchant, worker, large family. Same product, very different jobs:

| | Young mom | College student | Merchant |
|---|---|---|---|
| Motivation | Buying basic necessities easily | Buying eggs, rice, occasional cooking | Supplying merchandise |
| Behaviour | Likes to explore cooking | Rarely cooks | Requires regular supply |
| Order frequency | Every 3 days | Once a week | Twice a week |
| Needs | Staple food and vegetables, fast delivery | Eggs, rice, noodles | All staple items in bulk |

Personas are not decoration. They should visibly drive product and marketing
decisions later in your deck — if your personas never reappear, delete them.

## Competitor analysis

Identify and evaluate the competitors' products, sales and marketing tactics to
determine their strengths and weaknesses **relative to your own**. The comparison
table is the standard form:

| | You | Competitor A | Competitor B |
|---|---|---|---|
| Product | … | … | … |
| Coverage / delivery | … | … | … |
| Uniqueness | … | … | … |

Two rules:

- **Never write "we have no competitors."** It means you have not looked, or the
  market does not exist. Your competitor may be a spreadsheet, a WhatsApp group,
  or doing nothing at all — the *existing solution* from Module 2 is always a
  competitor.
- **Compare on axes that matter to the customer**, not on the ones where you
  happen to win.

## The 7P marketing mix

The tactics you use to meet customer needs and position your offering clearly in
the customer's mind:

- **Product** — the thing that fulfils the need; its attributes versus competitors
- **Price** — your price against competitors; price is often read as a proxy for quality
- **Place** — where it is available, and how convenient access is
- **Promotion** — how you promote it and reach the target audience
- **People** — the human connection between your service and the consumer
- **Process** — the processes that ensure quality standards are met
- **Physical Environment** — the environment affects satisfaction (a clean restaurant versus a dirty one)

For a service business the last three carry most of the weight, and they are the
three student teams most often ignore.

## Before you move on

Write your SOM as a single number, then write the one sentence that justifies the
step from SAM to SOM. If that sentence contains no named constraint, your number
is a guess.
$md$
)
on conflict (track_id, order_index) do update
  set title = excluded.title,
      content_md = excluded.content_md,
      est_minutes = excluded.est_minutes,
      is_draft = excluded.is_draft;

insert into public.quizzes (id, module_id, pass_threshold, questions_json, answer_key_json)
values (
  'c1000000-0000-4000-8000-000000000003',
  'b1000000-0000-4000-8000-000000000003',
  70,
  $json$  [
      {
          "id": "q1",
          "question": "Your SOM is 7,500 stores, but your revenue projection assumes 40,000 customers in year two. What have you done wrong?",
          "options": [
              "Nothing — SOM is only a marketing figure",
              "The SOM should always be larger than the projection",
              "The financial model is not built from the market sizing, so the two contradict each other",
              "You should raise the TAM to match"
          ]
      },
      {
          "id": "q2",
          "question": "A team presents only \"the Indonesian F&B market is worth IDR 1,500 trillion\". What is the problem?",
          "options": [
              "The number is too small to be interesting",
              "Market size should never appear in a proposal",
              "It should be expressed in USD",
              "TAM alone says nothing about what this business can actually serve or capture"
          ]
      },
      {
          "id": "q3",
          "question": "Which SWOT quadrant do judges use to tell a serious team from a superficial one?",
          "options": [
              "Weaknesses, because honesty there shows the team has really used its own product",
              "Strengths, because it shows confidence",
              "Opportunities, because it shows ambition",
              "Threats, because it shows awareness of competitors"
          ]
      },
      {
          "id": "q4",
          "question": "In STP, which step do student teams most often skip?",
          "options": [
              "Segmentation — they never divide the market",
              "Targeting — they try to serve everyone instead of choosing a beachhead",
              "Positioning — they never describe the product",
              "None; STP is usually done completely"
          ]
      },
      {
          "id": "q5",
          "question": "Your idea is genuinely new and you cannot find a direct competitor. What should the competitor analysis contain?",
          "options": [
              "A statement that there are no competitors",
              "Only international companies in adjacent markets",
              "The existing solution customers use today, even if it is a spreadsheet or doing nothing",
              "The section should be removed"
          ]
      }
  ]$json$::jsonb,
  $json$  [
      {
          "id": "q1",
          "correct_index": 2,
          "explanation": "Market sizing and financial projections must be one connected model. When the projection assumes more customers than the obtainable market contains, a judge has found the hole without needing to ask a question."
      },
      {
          "id": "q2",
          "correct_index": 3,
          "explanation": "TAM is the headline; SAM and SOM are where the thinking is. Every step down should be justified by a named constraint — coverage area, capacity, competition — which is what makes the final number credible."
      },
      {
          "id": "q3",
          "correct_index": 0,
          "explanation": "Every team writes strong strengths. A specific, uncomfortable weakness shows the team has used its own product and can see what needs fixing — and naming it first removes the question a judge was about to ask in QnA."
      },
      {
          "id": "q4",
          "correct_index": 1,
          "explanation": "Choosing a beachhead segment and explaining why is a strategic decision. Serving everyone at once is not a strategy, and judges read it as indecision rather than ambition."
      },
      {
          "id": "q5",
          "correct_index": 2,
          "explanation": "\"We have no competitors\" means you have not looked, or there is no market. The existing solution from the problem-to-idea chain is always a competitor — even if it is a spreadsheet, a WhatsApp group, or doing nothing at all."
      }
  ]$json$::jsonb
)
on conflict (module_id) do update
  set questions_json = excluded.questions_json,
      answer_key_json = excluded.answer_key_json,
      pass_threshold = excluded.pass_threshold;

-- ============================================================================
-- MODULE 4 — Financial Projection
-- ============================================================================

insert into public.learning_modules
  (id, track_id, order_index, title, est_minutes, is_draft, content_md)
values (
  'b1000000-0000-4000-8000-000000000004',
  '22222222-2222-4222-8222-222222222222',
  4,
  'Financial Projection',
  35,
  false,
  $md$
## What judges are really testing

Not whether your numbers are right — nobody can know that about a business that
does not exist yet. They are testing whether **you know where your numbers came
from**. A defensible model built from stated assumptions beats an impressive model
that appeared from nowhere.

Four measures do most of the work: **NPV**, **Payback Period**, **IRR** and
**ROI**.

## Build from drivers, not from wishes

A projection should be **bottom-up**. Start from the units:

```
customers (from your SOM)  ×  purchase frequency  ×  average value  =  revenue
```

Every one of those three inputs is an assumption, and every one should be visible.
A judge who can see your assumptions can argue with them, which is a conversation.
A judge who cannot will simply not believe the total.

Split costs the way you did on the canvas:

- **Fixed** — hosting and domain, app maintenance, R&D, salaries
- **Variable** — raw materials, per-unit production, commission, delivery

## Time value of money

**Money today is worth more than the same money in the future.**

The **discount rate** represents your cost of capital, or the minimum acceptable
rate of return an investor expects — the opportunity cost of money. It answers:

> *If I invest in this project, what minimum return must I get to make it worth it
> compared with my other options?*

Present value:

```
PV = FV / (1 + r)^n
```

At a 10% discount rate, IDR 1 million a year from now is worth about IDR 909,000
today.

## Net Present Value (NPV)

NPV is the difference between the present value of all cash inflows and outflows.

```
NPV = Σ [ CFt / (1 + r)^t ]  −  I₀

CFt = cash flow in year t
r   = discount rate
I₀  = initial investment
```

Decision rule:

- **NPV > 0** → the project is worth doing; it creates value
- **NPV = 0** → break-even in present-value terms
- **NPV < 0** → the project destroys value

Investors like ideas with a positive NPV **and measurable risk**. A large NPV built
on an unstated 60% growth assumption is not attractive; it is a warning.

## Payback Period

The time required for cumulative cash flow to equal the initial investment.

```
Payback = Initial Investment / Annual Cash Flow
```

| Year | Cash flow (IDR m) | Cumulative | Status |
|---|---|---|---|
| 1 | 200 | 200 | |
| 2 | 250 | 450 | |
| 3 | 300 | 750 | Break-even — payback 3 years |

Shorter payback means capital returns faster. Payback **ignores the time value of
money**, so it is not a substitute for NPV — but it is an excellent early screen,
and judges find it intuitive.

## Return on Investment (ROI) and scenarios

```
ROI = (Total Benefit − Total Cost) / Total Cost × 100%
```

Never present one ROI number. Present three:

| Scenario | Assumption | Total cost | Total benefit | ROI | Reading |
|---|---|---|---|---|---|
| Best | High sales, efficient costs | 500 m | 900 m | 80% | Maximum potential |
| Base | Realistic assumptions | 500 m | 750 m | 50% | The scenario you defend |
| Worst | Slow sales, rising costs | 500 m | 600 m | 20% | Downside risk |

Scenario cases test how your idea survives changing business conditions. A team
that shows a worst case is a team that has thought about risk — and when a judge
asks "what if sales are half what you assume?", you have already answered.

**Defend the base case.** The best case is context, not your claim.

## IRR, briefly

The internal rate of return is the discount rate at which NPV equals zero — the
project's own implied rate of return. Compare it against your cost of capital: if
IRR exceeds the rate an investor could get elsewhere, the project competes.

## Break-even point

The point where total revenue equals total cost. State it in months, and state
what it depends on. "BEP at 1.2 years" is a claim; "BEP at month 14, assuming we
reach 300 monthly subscribers" is a model.

## Where teams lose marks

- **The hockey stick.** Flat, flat, then a vertical climb in year three with no
  mechanism. If growth accelerates, name what causes it.
- **Numbers that do not reconcile.** Revenue implies more customers than your SOM
  contains, or unit costs contradict the cost structure on your canvas.
- **Unstated assumptions.** Any figure a judge cannot trace is a figure they will
  not credit.
- **False precision.** "IDR 4,283,917 in month 7" from a business with no customers
  reads as fake. Round, and state the assumption instead.
- **No funding ask.** If the category is fundraising, say how much you need, what
  it buys, and which milestone it reaches.

## Before you move on

Take your year-two revenue figure and write the chain that produces it: customers
× frequency × value, each traceable to your SOM. If any link is missing, that is
the number a judge will ask about.
$md$
)
on conflict (track_id, order_index) do update
  set title = excluded.title,
      content_md = excluded.content_md,
      est_minutes = excluded.est_minutes,
      is_draft = excluded.is_draft;

insert into public.quizzes (id, module_id, pass_threshold, questions_json, answer_key_json)
values (
  'c1000000-0000-4000-8000-000000000004',
  'b1000000-0000-4000-8000-000000000004',
  70,
  $json$  [
      {
          "id": "q1",
          "question": "A project has NPV below zero at your chosen discount rate. What does that mean?",
          "options": [
              "The project breaks even",
              "The payback period is too long",
              "The discount rate must be wrong",
              "The project destroys value at that required rate of return"
          ]
      },
      {
          "id": "q2",
          "question": "What does the discount rate actually represent?",
          "options": [
              "The cost of capital — the minimum return an investor expects, i.e. the opportunity cost of money",
              "The rate of inflation",
              "The discount you offer early customers",
              "The tax rate applied to profit"
          ]
      },
      {
          "id": "q3",
          "question": "Why is the payback period useful even though it ignores the time value of money?",
          "options": [
              "It replaces NPV in early-stage businesses",
              "It is a quick, intuitive screen for how fast capital comes back",
              "It is required by most competition guidebooks",
              "It accounts for risk better than NPV"
          ]
      },
      {
          "id": "q4",
          "question": "When presenting an ROI scenario sheet, which case should you defend as your claim?",
          "options": [
              "Best case, to show maximum potential",
              "Worst case, to appear conservative",
              "Base case, with best and worst shown as range",
              "The average of all three"
          ]
      },
      {
          "id": "q5",
          "question": "Your projection is flat for two years then climbs vertically in year three. What will judges ask?",
          "options": [
              "Nothing — rapid growth is expected in start-ups",
              "Whether you can lower the initial investment",
              "Whether you used the correct discount rate",
              "What mechanism causes the acceleration, since none is stated"
          ]
      }
  ]$json$::jsonb,
  $json$  [
      {
          "id": "q1",
          "correct_index": 3,
          "explanation": "NPV compares the present value of future cash flows against the initial investment at your required rate of return. Below zero means the project returns less than that required rate, so it destroys value rather than creating it."
      },
      {
          "id": "q2",
          "correct_index": 0,
          "explanation": "The discount rate is the cost of capital, or the minimum acceptable rate of return. It answers: if I invest here, what minimum return makes it worth it compared with my other options?"
      },
      {
          "id": "q3",
          "correct_index": 1,
          "explanation": "Payback ignores the time value of money, so it does not replace NPV. But it is fast, intuitive and easy for judges to reason about, which makes it an excellent early screen on an idea."
      },
      {
          "id": "q4",
          "correct_index": 2,
          "explanation": "The base case is your claim; best and worst show the range and prove you have thought about risk. Defending the best case invites a judge to dismantle it, and showing a worst case pre-answers the \"what if sales are half?\" question."
      },
      {
          "id": "q5",
          "correct_index": 3,
          "explanation": "A hockey stick with no mechanism is one of the fastest ways to lose credibility. If growth genuinely accelerates, name the cause — a new channel opening, a partnership landing, capacity coming online."
      }
  ]$json$::jsonb
)
on conflict (module_id) do update
  set questions_json = excluded.questions_json,
      answer_key_json = excluded.answer_key_json,
      pass_threshold = excluded.pass_threshold;

-- ============================================================================
-- MODULE 5 — Presentation & Pitching
-- ============================================================================

insert into public.learning_modules
  (id, track_id, order_index, title, est_minutes, is_draft, content_md)
values (
  'b1000000-0000-4000-8000-000000000005',
  '22222222-2222-4222-8222-222222222222',
  5,
  'Presentation & Pitching',
  30,
  false,
  $md$
## Start here

**Their default answer is "no".**

Judges and investors hear many pitches. The neutral position is rejection, and
nothing about a competent, unremarkable pitch moves them off it. Your job is not
to inform. It is to give them a reason to say yes — or at least to want to know
more.

The goal of a pitch is to attract people to explore more about your business. It
is not to explain everything.

## Know which pitch you are giving

- **Investment pitch** — get someone to fund you
- **Partnership pitch** — get someone to work with you
- **Sales pitch** — get someone to buy

A BPC final is almost always an *investment* pitch. That shapes everything.

## An investment pitch is two arguments

> Get someone to fund **your future plan**, based on **your past success**.

Future plan asks: *is this a good opportunity?*
Past success asks: *do these people have a good reputation?*

You need both. A brilliant plan from a team with no evidence of execution is a
lottery ticket.

**Historical success — if you have a running business:**
high revenue · high profit margin · low acquisition cost · tons of customers ·
high user retention · rapid growth · scalable

**Historical success — if you are pre-product** (most student teams):
experienced founders · validated idea · team composition · pre-sales commitment ·
personal investment · solution readiness

That second list is the one to mine. You may have no revenue, but you can show
that you interviewed forty warung owners, that three have committed to a pilot,
that you put your own money in, and that your team covers the skills the business
needs. **Personal investment and pre-sales commitment are the two most persuasive
items on it**, because both prove somebody already believed you.

**Your future plan and opportunity** should cover: industry profile · market size ·
unfair advantage · competition · financial projection · growth projection ·
strategic plan.

## Structure: three things that make information digestible

1. **Build a structured storyline.** Arrange the narrative with clear logic from
   beginning to end using a pyramid structure, so the audience can follow without
   confusion.
2. **Categorise information into buckets.** Group data and key points into large
   categories so information is concise and does not feel fragmented.
3. **Give key takeaways in every section.** Emphasise the core message of each
   part, so the audience knows what to remember and act on.

The practical test of a pyramid structure: **read only your slide titles**. If
they form a coherent argument on their own, the structure works. If they read as
topic labels — "Market", "Competitors", "Financials" — you have a table of
contents, not an argument.

## Content and delivery are separate skills

Both are required. A brilliant plan delivered badly loses to a good plan delivered
well, and this is the part teams practise least.

**Good presenters are trained, not born.** Nobody is naturally good at this.

### Hook first

Open with something that earns attention: a fact or a piece of data, a rhetorical
question, or a short story.

**Engage the audience directly.** *"Have you ever…?"* *"How many of you…?"* A
question that makes judges recognise the problem in their own experience does more
work than three slides of statistics.

**Tell a day in the life of your customer.** Storytelling is *narrative* — an
engaging, memorable message — and *persuasive* — an emotional and intellectual
connection. Judges remember the warung owner you described. They do not remember
your TAM.

### Breadth first, then depth

Cover the whole picture first, then go deep based on what the audience asks about.
Diving into your financial model on slide three loses everyone who has not yet
understood what you sell.

### Time allocation

Ask how much time you have. Then plan roughly **1 : 3 — presenting : discussing**.

The discussion is where the decision is made. A team that talks for the full slot
and leaves no room for questions has skipped the part that matters.

### Prepare multiple versions

- **3-minute version** — for when the schedule collapses
- **5-minute version**
- **10-minute version**
- **Supporting attachment** — the detail you do not present but can produce
- **Product demo** — if you have one, it beats any slide

You will be asked for a shorter version than you rehearsed. It happens constantly.

## Slide craft in a nutshell

**Slide**
Clean, neat and legible · do not be wordy · use visualisations · use bullet points ·
use shapes · use different line types (connectors, straight, dotted) · use arrows

**Colour**
Use 2–3 colours · synchronise colours across graphics, fonts, backgrounds and
visualisations · match the palette to your company, product or solution philosophy ·
check colour combinations before committing

**Font**
Use one font · vary capitalisation, size and placement to convey different
meanings · use bold, italics and underline deliberately · **minimum font size 10**

Two rules worth repeating:

- **A canvas is a design tool, not a presentation tool.** Do not put your BMC on a
  slide.
- **Do not waste time on obvious facts or common sense.** A slide explaining that
  Indonesia has 268 million people and high smartphone penetration tells a judge
  nothing they do not know — and makes them feel you are trying to teach them.

## Presentation is storytelling, not reading slides

If your slides contain everything you will say, the judges can read faster than
you can talk, and you have made yourself unnecessary. Slides support the story;
they are not the story.

## What to pay attention to when you present

- **Hook** → attention: fact or data, rhetorical question, short story
- **Storyline**: structured, logical, engaging
- **Intonation**: vary it; a flat delivery loses the room regardless of content
- **Body language**: open posture, eye contact, hands visible
- **Mastery of the material**: especially in QnA, because the client understands
  their own business better than you do

That last point is the one that decides finals. Anyone can rehearse a script. QnA
is where judges find out whether you understand your own numbers.

## Closing

End with a **strong message or call to action**, and a **tagline** they will
remember.

Then: **evaluate and take feedback.** After every competition, write down what the
judges asked. The questions you could not answer are your next version's agenda —
which is exactly what the version-to-version diagnostic in Champio is for.

## Before you move on

Write your slide titles as a list, with no other content. Read them top to bottom.
If they do not deliver your recommendation on their own, restructure before you
design a single slide.
$md$
)
on conflict (track_id, order_index) do update
  set title = excluded.title,
      content_md = excluded.content_md,
      est_minutes = excluded.est_minutes,
      is_draft = excluded.is_draft;

insert into public.quizzes (id, module_id, pass_threshold, questions_json, answer_key_json)
values (
  'c1000000-0000-4000-8000-000000000005',
  'b1000000-0000-4000-8000-000000000005',
  70,
  $json$  [
      {
          "id": "q1",
          "question": "What is the practical test of whether your deck has a pyramid structure?",
          "options": [
              "Reading only the slide titles delivers a coherent argument",
              "Every slide uses the same template",
              "The deck has fewer than 15 slides",
              "Each slide has exactly one visual"
          ]
      },
      {
          "id": "q2",
          "question": "Your team is pre-product with no revenue. Which evidence is most persuasive in an investment pitch?",
          "options": [
              "A larger TAM figure",
              "Pre-sales commitment and personal investment",
              "More slides on product features",
              "A longer list of future partnerships"
          ]
      },
      {
          "id": "q3",
          "question": "You have a 20-minute slot. How should you plan the time?",
          "options": [
              "Present for 20 minutes to cover everything",
              "Present for 15 minutes, 5 for questions",
              "Roughly 1:3 presenting to discussing, leaving most of the slot for questions",
              "Split evenly between presenting and demo"
          ]
      },
      {
          "id": "q4",
          "question": "Why is a slide explaining Indonesia's population and smartphone penetration usually a mistake?",
          "options": [
              "The data is often out of date",
              "Population data is irrelevant to every business",
              "Judges prefer international data",
              "It tells judges what they already know and makes it feel like you are teaching them"
          ]
      },
      {
          "id": "q5",
          "question": "Which part of a competition final most reliably separates teams?",
          "options": [
              "QnA, because it reveals whether the team truly understands its own numbers",
              "The visual design of the slides",
              "The length of the presentation",
              "The order of speakers"
          ]
      }
  ]$json$::jsonb,
  $json$  [
      {
          "id": "q1",
          "correct_index": 0,
          "explanation": "Action titles that read as a coherent argument top to bottom are the sign of a real storyline. Titles like \"Market\", \"Competitors\", \"Financials\" are a table of contents — they describe topics rather than making claims."
      },
      {
          "id": "q2",
          "correct_index": 1,
          "explanation": "For a pre-product team the persuasive list is experienced founders, validated idea, team composition, pre-sales commitment, personal investment and solution readiness. Pre-sales and personal investment are strongest because both prove someone already believed you."
      },
      {
          "id": "q3",
          "correct_index": 2,
          "explanation": "Plan roughly 1:3 presenting to discussing. The discussion is where the decision is actually made; a team that fills the whole slot has skipped the part that matters."
      },
      {
          "id": "q4",
          "correct_index": 3,
          "explanation": "Do not waste time on obvious facts or common sense. Judges know the macro numbers, and a slide teaching them the basics signals you had nothing more specific to say."
      },
      {
          "id": "q5",
          "correct_index": 0,
          "explanation": "Anyone can rehearse a script. QnA is where judges discover whether you understand your own model — and the client or judge frequently understands the industry better than you do, so mastery of the material is what holds up."
      }
  ]$json$::jsonb
)
on conflict (module_id) do update
  set questions_json = excluded.questions_json,
      answer_key_json = excluded.answer_key_json,
      pass_threshold = excluded.pass_threshold;
