// Chapter: language models, from word vectors to retrieval and fine-tuning.
import React from "react";
import { Eq } from "../kit";
import { AttentionSim, EmbedSim, FinetuneSim, HallucinationSim, NextTokenSim, RagSim, TokenSim } from "../sims/language";

export default {
  history: "Computers have handled text since the 1950s, but by counting words. In 2013 word vectors gave words a meaning-shaped place in space; in 2017 the transformer let a model read a whole passage at once; by 2022 large language models trained on much of the web could hold a conversation.",
  lessons: [
    {
      id: "embeddings",
      title: "Words as places on a map",
      lead: "Embeddings: turning meaning into numbers.",
      history: "The linguist J. R. Firth wrote in 1957 that 'you shall know a word by the company it keeps'. Tomáš Mikolov's team at Google turned that into word2vec in 2013, learning a vector for every word from which words appear near it, and showed that king − man + woman lands near queen.",
      gist: [
        "An embedding gives each word (or sentence, or image) a list of numbers: a position in space.",
        "It's learned so that things used in similar ways end up close together.",
        "Closeness then stands in for similar meaning, which is what search and language models build on.",
      ],
      practice: {
        adjust: ["Which embedding model, matched to your language and domain.", "Whether to embed whole documents or smaller chunks of them."],
        wrong: [
          "Models trained mostly on English do worse on Nepali, and on specialised jargon.",
          "Embeddings pick up the biases in their training text ('nurse' sits nearer 'she').",
          "Comparing vectors from two different embedding models, which live in different spaces.",
        ],
        notice: ["Look up the nearest neighbours of a few words or documents you know well: do they make sense?", "Check search results by hand for queries in each language you support."],
        ask: ["Show me the five nearest neighbours of this document.", "How does this embedding model rank on a benchmark for our language?"],
      },
      idea: (
        <p>
          A computer can't compare meanings, but it can compare numbers. An embedding places every word on a map, with hundreds of directions instead
          of two, learned so that words used in similar sentences end up near each other. Then "how similar are these words?" becomes "how close are
          these points?".
        </p>
      ),
      example: (
        <>
          <p>A food-delivery app wants searching for "dumplings" to find momos, even though the word "dumpling" never appears on the menu.</p>
          <p>
            Embedding the search and every dish puts "dumplings" right next to "momo" and "gyoza", because they turn up in the same kinds of
            sentences online. The search ranks dishes by closeness, and momos come first.
          </p>
        </>
      ),
      play: [{ Sim: EmbedSim, try: "Pick a few words and look at their neighbours. Then switch on king − man + woman and see where it lands." }],
      how: (
        <>
          <p>
            word2vec learns its vectors with a simple game: given a word, predict the words around it in real sentences. Words that keep the same
            company get pushed toward similar vectors. Modern embedding models are transformers that embed whole sentences or documents the same way.
          </p>
          <p>Closeness is usually measured by the angle between vectors, the cosine similarity:</p>
          <Eq says="1 means pointing the same way, 0 unrelated">
            cos(a, b) = (a · b) / (‖a‖ ‖b‖)
          </Eq>
          <p>
            Directions in the space can carry meaning: the step from "man" to "woman" is roughly the same as from "king" to "queen", which is why the
            analogy works (it works less neatly in real models than in the famous examples). The same trick embeds images, songs and products, which
            is how "more like this" searches work.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "Two embedding vectors are a = (1, 0) and b = (1, 1). What is their cosine similarity? (to two decimals)",
          answer: 0.71,
          tolerance: 0.01,
          why: "a · b = 1; ‖a‖ = 1, ‖b‖ = √2 ≈ 1.414. So 1 / 1.414 ≈ 0.71: an angle of 45°.",
        },
        {
          kind: "choice",
          q: "Why do 'momo' and 'dumpling' end up close in an embedding space?",
          options: [
            { t: "They appear in similar sentences, so training pushes their vectors together.", ok: true, why: "Right: similar company, similar vector." },
            { t: "Someone labelled them as synonyms.", why: "Embeddings learn from raw text, with no labels." },
            { t: "They are spelled similarly.", why: "They aren't; and spelling isn't what embeddings capture." },
            { t: "Both are short words.", why: "Length plays no part in the meaning of the vector." },
          ],
        },
        { kind: "task", q: "Find where king − man + woman lands.", Sim: EmbedSim, check: (s) => s.analogy && s.top === "queen", done: "The 'female' direction carried 'king' across to 'queen'." },
      ],
      explain: {
        q: "How would you explain an embedding to a non-technical colleague?",
        options: [
          { t: "It's a set of map coordinates for each word or document, learned so that things with similar meanings sit close together.", verdict: "right", why: "That's the core idea, and it explains why it's useful for search." },
          { t: "It's a dictionary definition stored as a number.", verdict: "wrong", why: "There's no definition in it. It's a position learned from usage." },
          { t: "It's a way of compressing text.", verdict: "partly", why: "It is compact, but the point is that distances mean something." },
          { t: "It's the model's understanding of the word.", verdict: "partly", why: "Loosely, but 'understanding' oversells it: it's where the word sits relative to others, learned from co-occurrence." },
        ],
      },
      readMore: [
        { title: "The illustrated word2vec", by: "Jay Alammar", url: "https://jalammar.github.io/illustrated-word2vec/" },
        { title: "Embeddings", by: "Google Machine Learning Crash Course", url: "https://developers.google.com/machine-learning/crash-course/embeddings" },
        { title: "Efficient estimation of word representations in vector space", by: "Mikolov et al. (2013)", url: "https://arxiv.org/abs/1301.3781" },
      ],
    },

    {
      id: "tokens",
      title: "Tokens, not words",
      lead: "How language models actually read text, and why it costs what it costs.",
      history: "Byte-pair encoding was invented by Philip Gage in 1994 to compress files. In 2016 Rico Sennrich and colleagues used it to split rare words into pieces for translation, and almost every large language model since reads text in these pieces, called tokens.",
      gist: [
        "Models read tokens: common words whole, rarer words in pieces, anything odd letter by letter.",
        "Tokens are what you pay for and what fills the context window, not words.",
        "Languages a tokenizer saw less of, Nepali included, take more tokens for the same meaning.",
      ],
      practice: {
        adjust: ["How much text you send: summarise or retrieve the relevant parts rather than pasting everything.", "Which model, partly by how well its tokenizer handles your language."],
        wrong: [
          "Assuming one token per word and underestimating cost and length limits.",
          "Asking a model to count letters or reverse words, which it can't see directly in tokens.",
          "Text silently cut off when a long input overflows the context window.",
        ],
        notice: ["Count tokens with the provider's tokenizer before estimating costs.", "Log tokens per request in production; spikes usually mean something pasted too much."],
        ask: ["How many tokens is our average request, in each language?", "What happens when an input is longer than the context window?"],
      },
      idea: (
        <p>
          A language model doesn't see letters or words. Its tokenizer chops text into pieces from a fixed vocabulary: "the" is one piece,
          "unbelievable" might be "un", "believ" and "able", and a word it has never seen comes out in small fragments. Everything the model does,
          and everything you pay for, is counted in these pieces.
        </p>
      ),
      example: (
        <>
          <p>A company budgets for a chatbot by counting words: 500 words a conversation, 10,000 conversations a day.</p>
          <p>
            The bill comes in noticeably higher. English runs at about four tokens for every three words, and their Nepali conversations, written in
            Devanagari, take several times more tokens per word, because the tokenizer saw far less Nepali in training.
          </p>
        </>
      ),
      play: [{ Sim: TokenSim, try: "Try each example, then type something of your own. Which kinds of text take the most tokens per word?" }],
      how: (
        <>
          <p>
            Byte-pair encoding builds the vocabulary by starting from single characters (or bytes) and repeatedly merging the most frequent adjacent
            pair into a new token, tens of thousands of times. Frequent words end up as single tokens; rare ones stay in pieces.
          </p>
          <p>
            Each token is then looked up as an embedding, and the model predicts one token at a time. Two practical consequences: the{" "}
            <strong>context window</strong> (how much the model can read at once) is measured in tokens, and so is the price. A useful rule for
            English is
          </p>
          <Eq says="a rough average; it varies by tokenizer and language">1 token ≈ ¾ of a word ≈ 4 characters</Eq>
          <p>
            Because the model sees "straw", "berry" rather than letters, questions like "how many r's are in strawberry?" are genuinely hard for it,
            and languages and scripts underrepresented in training get split more finely, costing more and leaving less room in the window.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "Using 1 token ≈ ¾ of a word, about how many tokens is a 600-word English document?",
          answer: 800,
          tolerance: 20,
          why: "600 ÷ 0.75 = 800 tokens.",
        },
        {
          kind: "choice",
          q: "Why can a language model struggle to count the letters in a word?",
          options: [
            { t: "It sees the word as one or a few tokens, not as individual letters.", ok: true, why: "Right: the letters are hidden inside the token." },
            { t: "It can't do arithmetic.", why: "Counting small numbers isn't the issue; seeing the letters is." },
            { t: "Its vocabulary has no single letters.", why: "It usually does have them; it just doesn't use them for common words." },
            { t: "Counting letters is against its rules.", why: "There's no such rule. It's a side effect of tokenization." },
          ],
        },
        { kind: "task", q: "Find text that needs at least two tokens per word.", Sim: TokenSim, check: (s) => s.words > 0 && s.tokens / s.words >= 2, done: "Rare words, other languages and long numbers all split finely." },
      ],
      explain: {
        q: "Why is an API priced per token rather than per word?",
        options: [
          { t: "Because tokens are what the model actually processes: each one costs a step of computation, whatever language it's in.", verdict: "right", why: "The work is done token by token, so that's the honest unit." },
          { t: "To make it more expensive.", verdict: "wrong", why: "It's the unit of work, not a trick, though it does cost more for some languages." },
          { t: "Because words have different lengths.", verdict: "partly", why: "That's part of it, but the real reason is the model works in tokens." },
          { t: "Tokens and words are the same thing.", verdict: "wrong", why: "They differ, especially for rare words and non-English text." },
        ],
      },
      readMore: [
        { title: "Let's build the GPT tokenizer", by: "Andrej Karpathy (video)", url: "https://www.youtube.com/watch?v=zduSFxRajkE" },
        { title: "Tokenizer playground", by: "OpenAI", url: "https://platform.openai.com/tokenizer" },
        { title: "Neural machine translation of rare words with subword units", by: "Sennrich, Haddow and Birch (2016)", url: "https://arxiv.org/abs/1508.07909" },
      ],
    },

    {
      id: "attention",
      title: "Who's 'it'?",
      lead: "Attention: how a transformer reads a sentence all at once.",
      history: "Dzmitry Bahdanau and colleagues added attention to translation models in 2014, letting them look back at the right source word. In 2017 Ashish Vaswani and seven co-authors at Google published 'Attention Is All You Need', a model built from attention alone: the transformer, the T in GPT.",
      gist: [
        "Attention lets every word look at every other word and decide which ones matter for it.",
        "That's how a model works out that 'it' means the animal in one sentence and the street in another.",
        "Stacking many attention layers builds up meaning, and all words are processed at once, which is fast.",
      ],
      practice: {
        adjust: ["Mostly nothing: attention is inside the model. What you control is what's in the context it attends over."],
        wrong: [
          "Very long contexts: the model attends less reliably to the middle than to the start and end.",
          "Relevant facts buried among lots of irrelevant text get less attention.",
          "Reading attention maps as explanations; they hint at what was used, they don't prove it.",
        ],
        notice: ["Test whether answers change when the key fact is placed at the start, middle or end of a long prompt."],
        ask: ["Put the most important instruction and facts first, and keep the context focused."],
      },
      idea: (
        <p>
          Older models read a sentence one word at a time and had to carry everything forward in their memory. A transformer lets every word look at
          all the others at once and decide how much each one matters to it. "It" looks around, finds "animal" and "tired", and takes its meaning from
          them.
        </p>
      ),
      example: (
        <>
          <p>
            Take "The animal didn't cross the street because it was too tired." A person knows "it" is the animal. Change the end to "too wide" and "it"
            is the street.
          </p>
          <p>
            A transformer gets both right because attention lets "it" weigh "tired" or "wide" when deciding what it refers to. No rule says so; the
            pattern is learned from billions of sentences.
          </p>
        </>
      ),
      play: [{ Sim: AttentionSim, try: "Look at what 'it' attends to, then change the last word. Try looking from 'street' and 'cross' too." }],
      how: (
        <>
          <p>
            Each word's embedding is turned into three vectors: a <strong>query</strong> (what am I looking for?), a <strong>key</strong> (what do I
            offer?) and a <strong>value</strong> (what do I pass on?). A word's attention to another is how well its query matches their key, softened
            into weights that add up to 1, and its new meaning is the weighted mix of everyone's values:
          </p>
          <Eq says="Q, K, V are the queries, keys and values; d is their length">
            Attention(Q, K, V) = softmax( QKᵀ / √d ) V
          </Eq>
          <p>
            A layer runs several of these in parallel (<strong>multi-head</strong> attention), each free to look for something different: grammar,
            what a pronoun refers to, nearby words. Dozens of layers are stacked. Because word order would otherwise be lost, each position gets a
            position signal added in. In a chatbot, attention is <strong>causal</strong>: each token may only look at the ones before it, since the
            future hasn't been written yet. The same mechanism powers the vision transformers in the vision chapter.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "choice",
          q: "What does attention let a word do?",
          options: [
            { t: "Weigh every other word in the context and mix in information from the most relevant ones.", ok: true, why: "That's it: a learned, weighted look around." },
            { t: "Look up its definition in a dictionary.", why: "There's no dictionary; meaning comes from the context and training." },
            { t: "Ignore all words except the one just before it.", why: "That's closer to old n-gram models. Attention looks at the whole context." },
            { t: "Correct its own spelling.", why: "Attention is about relating words, not spelling." },
          ],
        },
        {
          kind: "multi",
          q: "Which are true of transformers?",
          options: [
            { t: "They process all the tokens in a passage in parallel.", ok: true, why: "Unlike older recurrent models, which went one word at a time." },
            { t: "They need position information added, since attention alone ignores order.", ok: true, why: "Attention is a weighted mix, which doesn't care about order without it." },
            { t: "In chatbots each token can attend to future tokens.", why: "Generation is causal: a token can only attend to earlier ones." },
            { t: "The same idea is used for images.", ok: true, why: "Vision transformers treat image patches like tokens." },
          ],
        },
        { kind: "task", q: "Make 'it' attend most to the street.", Sim: AttentionSim, check: (s) => s.focus === 7 && s.top === "street", done: "One word at the end of the sentence changed what 'it' means." },
      ],
      explain: {
        q: "How does a language model know what 'it' refers to?",
        options: [
          { t: "Attention lets 'it' weigh all the other words; training has taught it which clues (like 'tired' or 'wide') point where.", verdict: "right", why: "A learned, context-dependent weighting, not a rule." },
          { t: "It follows a grammar rule that pronouns refer to the nearest noun.", verdict: "wrong", why: "The nearest noun here is 'street', which is wrong for 'tired'. It's learned, not rule-based." },
          { t: "It looks at the words around 'it'.", verdict: "partly", why: "True, but it looks at all the words, weighted by relevance, not just the neighbours." },
          { t: "It doesn't; it guesses randomly.", verdict: "wrong", why: "It gets these right far more often than chance." },
        ],
      },
      readMore: [
        { title: "The illustrated transformer", by: "Jay Alammar", url: "https://jalammar.github.io/illustrated-transformer/" },
        { title: "Attention in transformers, visually explained", by: "3Blue1Brown (video)", url: "https://www.youtube.com/watch?v=eMlx5fFNoYc" },
        { title: "Attention is all you need", by: "Vaswani et al. (2017)", url: "https://arxiv.org/abs/1706.03762" },
      ],
    },

    {
      id: "generation",
      title: "One word at a time",
      lead: "How a language model writes: predicting the next token, again and again.",
      history: "Claude Shannon generated text in 1948 by picking each next letter according to how often it followed the previous ones. GPT-2 (2019) and GPT-3 (2020) did the same with tokens and transformers at huge scale; ChatGPT (2022) added training on human feedback to make the result follow instructions.",
      gist: [
        "A language model does one thing: give the chance of every possible next token.",
        "It writes by picking a token, adding it to the text, and asking again, one token at a time.",
        "Temperature sets how adventurous the picking is: low is predictable, high is varied and riskier.",
      ],
      practice: {
        adjust: ["Temperature: near 0 for extraction and facts, higher for brainstorming.", "Maximum length and stop sequences.", "The prompt, since everything after is predicted from it."],
        wrong: ["High temperature drifting into nonsense.", "Zero temperature repeating itself in loops on long outputs.", "Expecting the same answer twice when sampling is on."],
        notice: ["Run the same prompt several times: how much does the answer vary?", "Look for repetition and for answers that trail off at the length limit."],
        ask: ["What temperature are we using, and why?", "Ask the same question five times: are the answers consistent?"],
      },
      idea: (
        <p>
          Underneath every chatbot is a model with one skill: given some text, it gives a probability for every possible next token. To write, it
          picks one, adds it to the text, and asks again. A whole essay is that loop run a few thousand times.
        </p>
      ),
      example: (
        <>
          <p>Given "The capital of Nepal is", the model puts most of its probability on " Kathmandu", some on " a" (as in "a city of…"), and a little on " beautiful".</p>
          <p>
            At temperature 0 it always says Kathmandu. At 1 it usually does, and occasionally starts "is a city in the valley…". At 2 the odd choices
            become common, which is fun for poems and bad for facts.
          </p>
        </>
      ),
      play: [{ Sim: NextTokenSim, try: "Write it ten times at temperature 0, 1 and 2. How many different endings do you get each time?" }],
      how: (
        <>
          <p>The model outputs a score (a logit) for every token in its vocabulary. Softmax turns scores into probabilities, divided first by the temperature T:</p>
          <Eq says="z are the scores; T near 0 makes the top one win outright">
            p<sub>i</sub> = e<sup>z<sub>i</sub>/T</sup> / Σ<sub>j</sub> e<sup>z<sub>j</sub>/T</sup>
          </Eq>
          <p>
            Low T sharpens the distribution toward the favourite; high T flattens it so unlikely tokens get a real chance. Other knobs trim the tail:{" "}
            <strong>top-k</strong> keeps only the k likeliest tokens, <strong>top-p</strong> keeps the smallest set covering, say, 90% of the probability.
          </p>
          <p>
            The model is trained on one task, predicting the next token of real text, across trillions of tokens. Chat models are then tuned on examples
            of good answers and on people's preferences between answers, which is why they follow instructions. But at heart it is still the loop:
            predict, pick, append, repeat.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "choice",
          q: "You want the same, most likely answer every time. Which temperature?",
          options: [
            { t: "0", ok: true, why: "It always takes the top token (greedy decoding)." },
            { t: "1", why: "That samples from the model's distribution, so answers vary." },
            { t: "2", why: "That flattens the distribution: more variety, not less." },
            { t: "It makes no difference.", why: "Temperature directly controls how random the picks are." },
          ],
        },
        {
          kind: "number",
          q: "Two tokens have scores 2 and 0. At temperature 1, what is the chance of the first? (to two decimals)",
          answer: 0.88,
          tolerance: 0.01,
          why: "e² / (e² + e⁰) = 7.39 / 8.39 ≈ 0.88.",
        },
        { kind: "task", q: "Get at least four different endings in ten tries.", Sim: NextTokenSim, check: (s) => s.draws > 0 && s.distinct >= 4, done: "High temperature gives variety, and you can see why it's risky for facts." },
      ],
      explain: {
        q: "How does a chatbot write a paragraph?",
        options: [
          { t: "It repeatedly predicts the probabilities of the next token, picks one, adds it to the text, and predicts again.", verdict: "right", why: "That loop is all there is; everything else shapes the probabilities." },
          { t: "It plans the paragraph, then writes it out.", verdict: "partly", why: "Its internal state can anticipate what comes next, but it still produces text strictly one token at a time." },
          { t: "It searches the internet and copies an answer.", verdict: "wrong", why: "A plain model doesn't search. Some products add search (retrieval) on top." },
          { t: "It looks the answer up in a database of facts.", verdict: "wrong", why: "There's no fact database inside; facts are spread through its weights, imperfectly." },
        ],
      },
      readMore: [
        { title: "Let's build GPT: from scratch, in code, spelled out", by: "Andrej Karpathy (video)", url: "https://www.youtube.com/watch?v=kCc8FmEb1nY" },
        { title: "Large language models explained briefly", by: "3Blue1Brown (video)", url: "https://www.youtube.com/watch?v=LPZh9BOjkQs" },
        { title: "Language models are few-shot learners (GPT-3)", by: "Brown et al. (2020)", url: "https://arxiv.org/abs/2005.14165" },
      ],
    },

    {
      id: "hallucination",
      title: "Confidently wrong",
      lead: "Why language models make things up, and what helps.",
      history: "'Hallucination' was used for neural translation systems that produced fluent sentences with no basis in the source, around 2018. When chatbots reached the public in 2022, invented facts, quotes and court cases became the best-known weakness of large language models.",
      gist: [
        "A model writes the most plausible continuation, and plausible isn't the same as true.",
        "When it doesn't know, it still produces a fluent answer, because nothing in it can tell remembering from guessing.",
        "Giving it the source, and rewarding 'I don't know', cut invented answers a lot; checking still matters.",
      ],
      practice: {
        adjust: ["Put the facts in the prompt (retrieval, next lesson) instead of relying on memory.", "Tell it to answer only from the given text and to say when it can't.", "Lower temperature for factual tasks."],
        wrong: ["Invented citations, names, numbers and dates, the classic cases.", "Confident tone on questions about rare or recent things.", "Plausible summaries that add details not in the source."],
        notice: ["Spot-check facts against the source, especially numbers and quotes.", "Ask for the supporting sentence for each claim, then check it exists."],
        ask: ["Quote the sentence from the document that supports each point.", "If the document doesn't say, reply 'not stated'."],
      },
      idea: (
        <p>
          A language model is trained to continue text plausibly. Ask it something it saw thousands of times and plausible is also true. Ask it
          something obscure and it does the same thing: produces whatever sounds most like an answer. It has no separate signal that says "I'm
          guessing now".
        </p>
      ),
      example: (
        <>
          <p>Asked when a small village library was founded, a chatbot replies "1956" in a confident sentence. The real year, from the library's own records, is 1959.</p>
          <p>
            Pasting the library's history into the prompt fixes it immediately: now the right year is in front of it, and copying beats guessing.
            Telling it that "not stated" is a fine answer stops it inventing one when the text doesn't say.
          </p>
        </>
      ),
      play: [{ Sim: HallucinationSim, try: "Ask without the source and see its answer. Then add the source; then, without the source, reward 'not sure'." }],
      how: (
        <>
          <p>
            Training rewards the model for predicting the next token of real text. Real text rarely says "I don't know", and a guess sounds more like
            the training data than a refusal, so the model learns to always answer. Facts it saw rarely are stored weakly in its weights, and several
            plausible answers end up with similar probability.
          </p>
          <p>Two things change the odds:</p>
          <ul>
            <li>
              <strong>Grounding</strong>: put the source in the prompt. Attending to text in front of it is far more reliable than recalling it from
              its weights.
            </li>
            <li>
              <strong>Calibrated refusals</strong>: training or instructions that make "I'm not sure" an acceptable answer, so a weak guess no longer
              beats it.
            </li>
          </ul>
          <p>
            Neither makes it zero. For anything that matters, have it cite the passage behind each claim, and check that the passage really says it.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "choice",
          q: "Why does a language model invent an answer instead of saying it doesn't know?",
          options: [
            { t: "It's trained to produce plausible text, and a confident guess is more plausible than a refusal.", ok: true, why: "Right; nothing in plain training rewards admitting ignorance." },
            { t: "It's designed to deceive users.", why: "There's no intent. It's a side effect of predicting plausible text." },
            { t: "Its internet connection failed.", why: "A plain model doesn't use the internet." },
            { t: "It always knows the answer but rounds it.", why: "It often genuinely lacks the fact; the guess fills the gap." },
          ],
        },
        {
          kind: "multi",
          q: "Which reduce made-up answers?",
          options: [
            { t: "Putting the relevant document in the prompt", ok: true, why: "Grounding: it can copy instead of recall." },
            { t: "Asking it to quote the sentence that supports each claim", ok: true, why: "Makes unsupported claims easier to spot." },
            { t: "Raising the temperature", why: "That makes unlikely, often wrong, tokens more likely." },
            { t: "Allowing 'not stated' as an answer", ok: true, why: "Gives it an alternative to guessing." },
          ],
        },
        { kind: "task", q: "Get the model to give the right year.", Sim: HallucinationSim, check: (s) => s.answer === "1959", done: "With the source in front of it, it copies rather than guesses." },
      ],
      explain: {
        q: "A colleague says the chatbot 'lied' about a date. How would you put it?",
        options: [
          { t: "It produced the most plausible-sounding answer without having the fact; it can't tell guessing from knowing, so we give it the source and check.", verdict: "right", why: "Accurate about the cause, and points at the fix." },
          { t: "It lied on purpose.", verdict: "wrong", why: "There's no intent to deceive in next-token prediction." },
          { t: "It made a mistake.", verdict: "partly", why: "True, but it misses why: the mistake is systematic for rare facts, which is what tells you how to prevent it." },
          { t: "The model is broken and shouldn't be used.", verdict: "wrong", why: "It's very useful with grounding and checks; it just isn't a database." },
        ],
      },
      readMore: [
        { title: "Survey of hallucination in natural language generation", by: "Ji et al. (2023)", url: "https://arxiv.org/abs/2202.03629" },
        { title: "Reduce hallucinations", by: "Anthropic documentation", url: "https://docs.anthropic.com/en/docs/test-and-evaluate/strengthen-guardrails/reduce-hallucinations" },
      ],
    },

    {
      id: "rag",
      title: "An open-book exam",
      lead: "Retrieval-augmented generation: giving the model your documents.",
      history: "Patrick Lewis and colleagues at Facebook AI named retrieval-augmented generation in 2020, pairing a search step with a language model. By 2023 it was the standard way to make chatbots answer from a company's own documents, cheaper and easier to update than retraining.",
      gist: [
        "First search your documents for the passages relevant to the question, then put them in the prompt.",
        "The model answers from those passages, so it's current, specific to you, and can cite where it got it.",
        "The answer can only be as good as the search: if the right passage isn't retrieved, the model can't use it.",
      ],
      practice: {
        adjust: ["How documents are cut into chunks, and how big.", "How many chunks to retrieve (k).", "Keyword search, embedding search, or both (hybrid)."],
        wrong: ["The right passage never retrieved, because it uses different words from the question.", "Too many chunks: the key one gets buried.", "Stale or contradictory documents in the index."],
        notice: ["Evaluate retrieval on its own: for a set of real questions, is the right passage in the top k?", "Log which chunks each answer used."],
        ask: ["For these 50 real questions, how often is the answer's source in the top 3?", "Show the retrieved passages alongside every answer."],
      },
      idea: (
        <p>
          Instead of hoping the model memorised your refund policy, look it up first. Search your documents for the passages that match the question,
          paste them into the prompt, and ask the model to answer from them. It turns a closed-book exam into an open-book one.
        </p>
      ),
      example: (
        <>
          <p>A shop's chatbot keeps giving a generic refund answer. Its policy pages aren't in the model's training data, and they change every quarter.</p>
          <p>
            With retrieval, a customer's question first pulls the two most relevant policy paragraphs. The model answers from those and links them.
            When the policy changes, they update the document, not the model.
          </p>
        </>
      ),
      play: [{ Sim: RagSim, try: "Try each question with k = 1 and k = 2. Which question does word matching fail on, and why?" }],
      how: (
        <>
          <p>The pipeline has an offline part and an online part:</p>
          <ol>
            <li>
              <strong>Index</strong>: split documents into chunks of a few hundred tokens and embed each one (lesson 1).
            </li>
            <li>
              <strong>Retrieve</strong>: embed the question and fetch the k chunks with the most similar vectors, often combined with keyword search.
            </li>
            <li>
              <strong>Generate</strong>: put the chunks in the prompt with an instruction to answer only from them and cite them.
            </li>
          </ol>
          <p>Retrieval quality is measured on its own, before the model is involved, for example by recall at k:</p>
          <Eq says="over a test set of questions with known source passages">recall@k = share of questions whose source passage is in the top k</Eq>
          <p>
            Embeddings fix the vocabulary problem keyword search has ("phone" matches "electronics" by meaning). A <strong>re-ranker</strong> can
            re-score the top candidates more carefully. And because the answer cites passages, it can be checked.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "On 40 test questions, the right passage is in the top 3 for 34. What is recall@3? (between 0 and 1)",
          answer: 0.85,
          tolerance: 0.005,
          why: "34 / 40 = 0.85.",
        },
        {
          kind: "choice",
          q: "Answers are wrong, and the logs show the right passage was never retrieved. What should you fix?",
          options: [
            { t: "The retrieval: chunking, embeddings, or adding keyword search.", ok: true, why: "The model can't use what it never sees." },
            { t: "Switch to a bigger language model.", why: "A bigger model still can't answer from a passage it wasn't given." },
            { t: "Raise the temperature.", why: "That changes the wording, not what information is available." },
            { t: "Fine-tune on the documents.", why: "Possible, but heavier, and it would still need updating; fix retrieval first." },
          ],
        },
        { kind: "task", q: "Find the right document for the phone question.", Sim: RagSim, check: (s) => s.q === 0 && s.found, done: "It took a bigger k, because word matching doesn't know a phone is electronics. Embedding search would have found it first." },
      ],
      explain: {
        q: "What is retrieval-augmented generation, in one sentence?",
        options: [
          { t: "Search your own documents for passages relevant to the question, then have the model answer from those passages.", verdict: "right", why: "Search, then generate from what was found." },
          { t: "Retraining the model on your documents.", verdict: "wrong", why: "That's fine-tuning. RAG leaves the model unchanged." },
          { t: "Letting the model search the web.", verdict: "partly", why: "Web search is one kind of retrieval, but RAG usually means your own document collection." },
          { t: "A way to make the model's answers longer.", verdict: "wrong", why: "It's about grounding, not length." },
        ],
      },
      readMore: [
        { title: "Retrieval-augmented generation for knowledge-intensive NLP tasks", by: "Lewis et al. (2020)", url: "https://arxiv.org/abs/2005.11401" },
        { title: "Contextual retrieval", by: "Anthropic", url: "https://www.anthropic.com/news/contextual-retrieval" },
        { title: "Hugging Face LLM course", by: "Hugging Face", url: "https://huggingface.co/learn/llm-course" },
      ],
    },

    {
      id: "fine-tuning",
      title: "Teach it, or tell it?",
      lead: "Prompting, examples in the prompt, or fine-tuning.",
      history: "Fine-tuning a pretrained model on a smaller task became standard with ULMFiT and BERT in 2018. GPT-3 (2020) showed that a few examples in the prompt could often do the job instead, and LoRA (2021) made fine-tuning big models cheap by training only a small add-on.",
      gist: [
        "Prompting tells the model what you want; a few examples in the prompt show it.",
        "Fine-tuning trains it further on many examples, so the behaviour is built in.",
        "Start with prompting and retrieval; fine-tune when you have lots of examples and a narrow, stable task.",
      ],
      practice: {
        adjust: ["The instructions and the examples in the prompt.", "For fine-tuning: how many examples, how clean they are, and a held-out test set."],
        wrong: [
          "Fine-tuning to teach new facts, which works poorly and goes stale; facts belong in retrieval.",
          "Fine-tuning on a few hundred messy examples and getting a worse model.",
          "Never measuring, so nobody knows whether the extra cost paid off.",
        ],
        notice: ["Build a test set of real cases first, and score every approach on it.", "Compare cost and speed per request, not just accuracy."],
        ask: ["What does the best prompt score on our test set, before we consider fine-tuning?", "How many good labelled examples do we actually have?"],
      },
      idea: (
        <p>
          There are two ways to get a model to do your task. Tell it: write instructions and maybe show a few examples in the prompt. Or teach it:
          train it further on your examples until the behaviour is built in. Telling is quick and cheap to change; teaching takes data and effort, but
          can be more accurate and consistent for a narrow job.
        </p>
      ),
      example: (
        <>
          <p>A bank wants support tickets sorted into twelve categories.</p>
          <p>
            A good prompt with five examples per category gets 78% right on their test set, in an afternoon. Two months later they have 3,000
            hand-labelled tickets; fine-tuning a small model on them reaches 93%, and runs cheaper per ticket than the big model with its long prompt.
          </p>
        </>
      ),
      play: [{ Sim: FinetuneSim, try: "Slide the number of labelled examples. Where does fine-tuning start to win?" }],
      how: (
        <>
          <p>
            <strong>Prompting</strong> changes nothing in the model; it changes the input. <strong>Few-shot</strong> prompting puts worked examples in
            the input, which works surprisingly well, but only so many fit in the context, and each one costs tokens on every request.
          </p>
          <p>
            <strong>Fine-tuning</strong> continues training on (input, desired output) pairs, by the same gradient descent as before, so the weights
            themselves change. Full fine-tuning updates every weight; <strong>LoRA</strong> freezes them and trains a small low-rank add-on instead:
          </p>
          <Eq says="W is a frozen weight matrix; B and A are small, trained">
            W′ = W + B·A
          </Eq>
          <p>
            A rough order to try things in: a clear prompt; add examples; add retrieval if it needs your facts; fine-tune when you have hundreds to
            thousands of good examples of a narrow, stable task, or need a smaller, cheaper model to match a bigger one. Measure each step on the same
            test set.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "choice",
          q: "Your chatbot needs to know this month's prices. What's the right tool?",
          options: [
            { t: "Retrieval: look the prices up and put them in the prompt.", ok: true, why: "Facts that change belong in documents the model reads, not in its weights." },
            { t: "Fine-tune it on the price list every month.", why: "Costly, slow and unreliable for facts; it'd be stale between retrains." },
            { t: "A higher temperature.", why: "That doesn't add any information." },
            { t: "Nothing; it already knows.", why: "It can't know prices set after its training." },
          ],
        },
        {
          kind: "choice",
          q: "When is fine-tuning usually worth it?",
          options: [
            { t: "Many good examples of a narrow, stable task, or to make a smaller model match a bigger one.", ok: true, why: "That's where its extra accuracy and lower cost per request pay back the effort." },
            { t: "With 20 examples, to save writing a prompt.", why: "Too few; a prompt with those examples will do as well." },
            { t: "To teach the model breaking news.", why: "That's retrieval's job." },
            { t: "Always, before trying prompts.", why: "Try the cheap options first and measure." },
          ],
        },
        { kind: "task", q: "Find a number of examples where fine-tuning beats prompting.", Sim: FinetuneSim, check: (s) => s.tuned > s.prompt, done: "With enough good examples, the trained-in behaviour wins, and it no longer pays for examples in every prompt." },
      ],
      explain: {
        q: "What's the difference between prompting and fine-tuning?",
        options: [
          { t: "Prompting changes what you send the model; fine-tuning changes the model itself, by training it on examples.", verdict: "right", why: "Input versus weights: that's the whole distinction." },
          { t: "Fine-tuning is just a longer prompt.", verdict: "wrong", why: "It changes the weights; the prompt can be short afterwards." },
          { t: "They're different ways of teaching the model a task.", verdict: "partly", why: "True, but it leaves out the key difference: only one of them changes the model." },
          { t: "Prompting is for chat, fine-tuning is for code.", verdict: "wrong", why: "Both work for any kind of task." },
        ],
      },
      readMore: [
        { title: "LoRA: low-rank adaptation of large language models", by: "Hu et al. (2021)", url: "https://arxiv.org/abs/2106.09685" },
        { title: "Prompt engineering overview", by: "Anthropic documentation", url: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview" },
        { title: "Hugging Face LLM course", by: "Hugging Face", url: "https://huggingface.co/learn/llm-course" },
      ],
    },
  ],
};

