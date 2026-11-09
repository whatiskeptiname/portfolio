// Chapter: neural networks, from one neuron to training deep networks and
// remembering sequences. Builds on gradient descent (foundations) and leads
// into the vision and language chapters.
import React from "react";
import { Eq } from "../kit";
import { ActivationSim, BackpropSim, LayersSim, MemorySim, NeuronSim, NormSim, TraceSim, TrainingSim } from "../sims/neural";

export default {
  history: "The artificial neuron is from 1943 and the first learning machine, the perceptron, from 1958. The field nearly died twice, then backpropagation (1986), big datasets and graphics cards (2012) made deep networks the engine behind today's vision and language models.",
  lessons: [
    {
      id: "neurons",
      title: "A neuron is a weighted vote",
      lead: "The artificial neuron, and the one thing it can't do.",
      history: "Warren McCulloch and Walter Pitts proposed a mathematical neuron in 1943. Frank Rosenblatt built the perceptron in 1958, a machine that learned its own weights. In 1969 Marvin Minsky and Seymour Papert showed a single perceptron can't learn even XOR, and funding for the idea dried up for over a decade.",
      gist: [
        "A neuron multiplies each input by a weight, adds them up with a bias, and passes the total through an activation.",
        "Training means finding the weights, by the same gradient descent as any other model.",
        "One neuron can only draw a straight line between classes, so some simple patterns are beyond it.",
      ],
      practice: {
        adjust: ["Nothing at this level by hand; you'll choose layer sizes and activations, and training finds the weights."],
        wrong: ["Expecting a single-layer model (which is what logistic regression is) to learn a pattern that needs a curved boundary."],
        notice: ["A linear model stuck well below the accuracy you'd expect: the boundary may need to bend."],
        ask: ["Is this problem linearly separable, or do we need hidden layers (or better features)?"],
      },
      idea: (
        <p>
          An artificial neuron is a tiny voting machine. Each input gets a weight saying how much it counts and in which direction; the neuron adds up
          the weighted votes, adds a bias, and "fires" if the total is high enough. It's loosely inspired by brain cells, but it is really just
          logistic regression with a new name.
        </p>
      ),
      example: (
        <>
          <p>A college admits students from two exam scores. One neuron, with the right weights, draws a line: above it admitted, below it not, and it gets every past case right.</p>
          <p>
            But if the rule were "admit if both scores are high or both are low", no single line could separate the two groups. One neuron can never
            learn that, however long it trains.
          </p>
        </>
      ),
      play: [{ Sim: NeuronSim, try: "On the separable data, set the weights and bias to get everything right. Then switch to XOR and try to get past 75%." }],
      how: (
        <>
          <p>A neuron computes a weighted sum and passes it through an activation function f:</p>
          <Eq says="x are the inputs, w the weights, b the bias">
            output = f( w<sub>1</sub>x<sub>1</sub> + w<sub>2</sub>x<sub>2</sub> + … + b )
          </Eq>
          <p>
            With a step function for f it's Rosenblatt's perceptron; with the sigmoid it's exactly logistic regression. Either way, the place where the
            total is zero is a straight line (a flat plane with more inputs), so the neuron can only split the inputs with one cut.
          </p>
          <p>
            XOR (one or the other, but not both) needs two cuts. That limitation is what the next lesson fixes, by stacking neurons in layers.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "A neuron has weights 2 and −1 and bias 0.5. Inputs are 1 and 3. What is the weighted sum before the activation?",
          answer: -0.5,
          tolerance: 0.001,
          why: "2 × 1 + (−1) × 3 + 0.5 = 2 − 3 + 0.5 = −0.5.",
        },
        {
          kind: "choice",
          q: "Why can't a single neuron learn XOR?",
          options: [
            { t: "Its decision boundary is a single straight line, and XOR's classes can't be split by one line.", ok: true, why: "XOR needs two cuts, so it needs more than one neuron." },
            { t: "It hasn't been trained long enough.", why: "No amount of training helps: no setting of the weights works." },
            { t: "XOR has too many data points.", why: "It fails with just four points." },
            { t: "Its activation function is wrong.", why: "Any activation still gives one straight boundary for one neuron." },
          ],
        },
        { kind: "task", q: "On the separable data, set the weights and bias so the neuron gets every point right.", Sim: NeuronSim, check: (s) => s.data === "line" && s.acc === 1, done: "One line, the right one. Now you've seen what one neuron can do; XOR shows what it can't." },
      ],
      explain: {
        q: "What does one artificial neuron do?",
        options: [
          { t: "It adds up its inputs, each multiplied by a learned weight, plus a bias, and passes the total through a function that decides how strongly it fires.", verdict: "right", why: "Weighted sum plus activation: that's all of it." },
          { t: "It works like a brain cell.", verdict: "partly", why: "Loosely inspired by one, but it's simple arithmetic, far simpler than a real neuron." },
          { t: "It stores a fact.", verdict: "wrong", why: "It stores weights, not facts; meaning only emerges across many neurons." },
          { t: "It makes a yes/no decision by looking things up.", verdict: "wrong", why: "There's no lookup; it computes a weighted sum." },
        ],
      },
      readMore: [
        { title: "But what is a neural network?", by: "3Blue1Brown (video)", url: "https://www.youtube.com/watch?v=aircAruvnKk" },
        { title: "Neural networks", by: "Google Machine Learning Crash Course", url: "https://developers.google.com/machine-learning/crash-course/neural-networks" },
      ],
    },

    {
      id: "layers",
      title: "Bending the line",
      lead: "Hidden layers and activation functions: why depth works.",
      history: "It was known by the 1960s that layers of neurons could represent XOR; nobody knew how to train them. George Cybenko proved in 1989 that one hidden layer of enough neurons can approximate almost any function, which made multilayer networks the general-purpose tool they are today.",
      gist: [
        "Put neurons in layers: the first layer's outputs become the next layer's inputs.",
        "A non-linear activation between layers lets each layer bend the boundary; without one, stacking adds nothing.",
        "With enough hidden neurons a network can draw almost any shape, which is also how it can overfit.",
      ],
      practice: {
        adjust: ["The number of layers and neurons per layer.", "The activation: ReLU is the usual default in hidden layers."],
        wrong: ["Forgetting the activation, so a deep network behaves like a single linear one.", "A network far bigger than the data can support, which memorises it."],
        notice: ["Training loss that won't go down: too small a network, or a bug.", "Training loss near zero and validation loss rising: too big, or too long."],
        ask: ["What's the simplest network that reaches our target on validation data?"],
      },
      idea: (
        <p>
          One neuron draws one line. Several neurons in a hidden layer draw several lines, and a neuron after them combines those lines into a shape:
          a corner, a strip, a blob. Add more layers and the shapes combine again. The secret ingredient is the activation function between layers,
          which lets each layer bend what came before instead of just adding it up.
        </p>
      ),
      example: (
        <>
          <p>The XOR data from the last lesson defeats a single neuron at about 50–75%.</p>
          <p>
            Give the network a hidden layer of four neurons and train it: each hidden neuron learns a different line, and the output neuron combines
            them. It gets nearly every point right, carving out the two diagonal corners.
          </p>
        </>
      ),
      play: [{ Sim: LayersSim, try: "Train with no hidden layer, then with 1, 2 and 4 hidden neurons. How many does it take to solve XOR?" }],
      how: (
        <>
          <p>A layer applies many neurons at once, written as a matrix multiplication followed by the activation:</p>
          <Eq says="W and b are the layer's weights and biases; f is applied to every number">
            h = f( W x + b ), &nbsp; output = σ( W′ h + b′ )
          </Eq>
          <p>
            If f were missing, W′(Wx + b) is just another linear function, so a hundred layers would be no better than one. Common activations are tanh,
            the sigmoid and, by far the most used today, <strong>ReLU</strong>: max(0, z), which is fast and keeps gradients healthy in deep networks.
          </p>
          <p>
            The <strong>universal approximation theorem</strong> says one wide enough hidden layer can approximate any reasonable function. In practice
            deeper, narrower networks learn the same things with far fewer weights, because each layer builds on the features of the one before:
            edges, then shapes, then objects, as in the vision chapter.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "choice",
          q: "What happens if you stack ten layers but use no activation function between them?",
          options: [
            { t: "The whole network is still just one linear function, no more powerful than a single layer.", ok: true, why: "A product of linear maps is linear. The activation is what lets layers bend." },
            { t: "It becomes ten times more powerful.", why: "Without non-linearity the layers collapse into one." },
            { t: "It can't be trained at all.", why: "It can be trained; it just can't learn curved boundaries." },
            { t: "It overfits immediately.", why: "It's limited, not over-flexible." },
          ],
        },
        {
          kind: "number",
          q: "ReLU is max(0, z). What does it output for z = −2.5?",
          answer: 0,
          tolerance: 0,
          why: "max(0, −2.5) = 0: ReLU passes positive numbers through and zeroes the rest.",
        },
        { kind: "task", q: "Train a network that gets more than 90% of the XOR points right.", Sim: LayersSim, check: (s) => s.acc != null && s.acc > 0.9, done: "A handful of hidden neurons, each drawing a line, and a bent boundary built from them." },
      ],
      explain: {
        q: "Why do neural networks have hidden layers?",
        options: [
          { t: "Each layer combines and bends the previous layer's outputs, so together they can form boundaries and features no single layer could.", verdict: "right", why: "Composition of simple bent pieces is what gives networks their power." },
          { t: "To hide how the model works.", verdict: "wrong", why: "'Hidden' just means not an input or an output." },
          { t: "To make the model bigger.", verdict: "partly", why: "They do add size, but the point is the non-linear combinations they make possible." },
          { t: "Because more layers are always better.", verdict: "wrong", why: "Too many for the data overfits; deeper also needs care to train." },
        ],
      },
      readMore: [
        { title: "TensorFlow Playground", by: "Smilkov and Carter (interactive)", url: "https://playground.tensorflow.org/" },
        { title: "Neural networks", by: "Google Machine Learning Crash Course", url: "https://developers.google.com/machine-learning/crash-course/neural-networks" },
        { title: "Deep Learning, chapter 6: deep feedforward networks", by: "Goodfellow, Bengio and Courville (free book)", url: "https://www.deeplearningbook.org/contents/mlp.html" },
      ],
    },

    {
      id: "activations",
      title: "The bend in the wire",
      lead: "Activation functions, and which one goes where.",
      history: "Early networks used the sigmoid, modelled on a neuron's firing rate, and tanh. Vinod Nair and Geoffrey Hinton popularised the rectified linear unit (ReLU) in 2010, and its use in AlexNet (2012) made deep networks trainable. Transformers since 2018 mostly use GELU, a smooth cousin of ReLU.",
      gist: [
        "The activation is the bend after each layer; without it a deep network collapses into a single straight line.",
        "Its slope decides how well the learning signal survives the trip backwards: sigmoid and tanh squash it, ReLU-like ones pass it through.",
        "Each kind of network has its habits: ReLU in CNNs, GELU in transformers, tanh and sigmoid inside RNN gates, and the output layer matched to the answer.",
      ],
      practice: {
        adjust: [
          "Hidden layers: ReLU (or leaky ReLU) for CNNs and MLPs, GELU for transformers.",
          "Output layer, by the answer: sigmoid for yes/no, softmax for one of several classes, nothing (linear) for a number.",
          "The weight initialisation that goes with it: He for the ReLU family, Xavier for tanh and sigmoid.",
        ],
        wrong: [
          "Sigmoid or tanh in the hidden layers of a deep network: the gradient vanishes and early layers stop learning.",
          "Dead ReLUs: neurons stuck below zero output nothing and get no gradient, so they never recover (a big learning rate makes it worse).",
          "A sigmoid output on a regression target, which can never predict outside 0–1.",
        ],
        notice: ["Count neurons that output zero for every input (dead ReLUs).", "Gradients near zero in the first layers while the last ones still learn."],
        ask: ["What activation is in each layer, and does the output layer match the kind of answer?", "How many neurons are dead after training?"],
      },
      idea: (
        <>
          <p>
            After each layer adds up its inputs, the activation function bends the result: squashing it, cutting off the negatives, or curving it
            slightly. That bend is what lets layers build shapes. But the same function sits on the path back too, when backpropagation passes the
            blame: wherever its slope is small, the learning signal shrinks. Choosing an activation is choosing a trade-off between the two.
          </p>
          <p>
            Where exactly does it happen? Each connection into a neuron carries one input times one weight. The neuron adds those up with its bias to
            get a single number, z. The activation is applied to that z, inside the neuron, one neuron at a time, and only its result travels out
            along the next layer's weights. The activation has no weights of its own: every number the network learns sits on the connections and
            biases, and the activation is the one step between them that isn't a straight line.
          </p>
        </>
      ),
      example: (
        <>
          <p>
            A team builds a 20-layer network with sigmoid activations, the textbook choice of the 1990s. The loss barely moves: the last layers learn,
            but by the time the blame reaches the first ones it has been multiplied by numbers under a quarter twenty times, and it's all but zero.
          </p>
          <p>Switching the hidden layers to ReLU, with matching initialisation, and keeping a single sigmoid only at the output for the yes/no answer, it trains in an afternoon.</p>
          <p>
            Now the bend itself, with numbers you can check in the first simulation below. A small network has three inputs, three hidden neurons and
            two outputs. Feed it the input (1, −2, 0.5). The first hidden neuron's weights are 0.8, −0.5 and 0.3, and its bias is 0.1, so
          </p>
          <Eq says="each input times the weight on its connection, plus the bias">z = 0.8·1 + (−0.5)·(−2) + 0.3·0.5 + 0.1 = 2.05</Eq>
          <p>
            The other two neurons get −1.15 and −1.1. Without an activation those three numbers go straight on, and output 1 comes to 2.31. Do the
            algebra and the two layers fold into one: output 1 is always 1.47·x₁ − 0.43·x₂ − 0.53·x₃ + 0.24, for every input. Six hidden weights
            bought nothing a single layer couldn't do.
          </p>
          <p>
            With ReLU, the hidden layer passes on 2.05, 0 and 0: the two negative neurons are switched off for this input, and output 1 drops to
            2.05. Feed it (2, 0.5, 1.5) instead and all three sums are positive, so ReLU changes nothing. That's the whole trick. Each input switches
            on its own set of neurons, so each region of inputs gets its own straight line, and the network is a patchwork of them: a bent shape no
            single layer can make.
          </p>
          <p>
            The same switch works backwards. For the first input, neurons 2 and 3 have slope 0, so their incoming weights get no blame and don't
            change from this example. With a sigmoid instead, neuron 1 sits at 0.89 and its slope is 0.89 × 0.11 ≈ 0.10, so only a tenth of the
            blame gets through. Stack twenty of those and you have the team's problem.
          </p>
        </>
      ),
      play: [
        { Sim: TraceSim, try: "Start with no activation and note both outputs for input #1. Switch to ReLU and watch which hidden neurons go to 0. Then try input #3." },
        { Sim: ActivationSim, try: "Compare sigmoid, tanh and ReLU at 10 and 30 layers. Which keeps the learning signal alive?" },
      ],
      how: (
        <>
          <p>The usual suspects, with what they're for:</p>
          <ul>
            <li>
              <strong>Sigmoid</strong> σ(z) = 1/(1+e<sup>−z</sup>): output 0–1, slope at most 0.25. For yes/no outputs and gates, not deep hidden layers.
            </li>
            <li>
              <strong>Tanh</strong>: output −1 to 1, centred on zero, slope at most 1. Inside RNNs and LSTMs, alongside sigmoid gates.
            </li>
            <li>
              <strong>ReLU</strong> max(0, z): slope exactly 1 for positive inputs, so the signal passes unshrunk; cheap. The default for CNNs and MLPs.{" "}
              <strong>Leaky ReLU</strong> gives negatives a small slope so neurons can't die.
            </li>
            <li>
              <strong>GELU</strong> z·Φ(z): a smooth ReLU that lets a little negative through; standard in BERT, GPT and vision transformers.
            </li>
            <li>
              <strong>Softmax</strong>: turns the output layer's scores into probabilities over classes (or over next tokens, in the language chapter).
            </li>
          </ul>
          <p>Going back through a layer multiplies the gradient by the weights and by the activation's slope. In a wide network its size changes per layer by roughly</p>
          <Eq says="gain² comes from the weight initialisation; the slope is averaged over typical inputs">
            factor ≈ gain² · E[ slope² ]
          </Eq>
          <p>
            For sigmoid this is about 0.04 per layer (so 20 layers leave almost nothing); ReLU with He initialisation gives exactly 1. That's why
            initialisation and activation are chosen together.
          </p>
          <p>Why each kind of network ends up with its own:</p>
          <ul>
            <li>
              <strong>CNNs</strong> stack convolution, normalisation and ReLU, often 50 to 150 times. They need a slope that doesn't shrink over that
              many layers, and something cheap, because each layer applies it at every pixel position of every feature map. ReLU is both. It also
              leaves many outputs at exactly zero, so each filter answers only where its pattern appears.
            </li>
            <li>
              <strong>Transformers</strong> use the activation only in the feed-forward part of each block (attention has its own softmax). Layer
              norm sits just before it, so the sums arrive centred on zero, which is exactly where ReLU has its sharp corner and its dead side. GELU
              rounds the corner and lets a little negative through, so neurons don't die and the gradient changes smoothly. In big models that trains
              slightly better, and many recent ones go further with SwiGLU, a gated version.
            </li>
            <li>
              <strong>RNNs and LSTMs</strong> reuse the same weights at every time step, so the hidden state is multiplied by the same matrix a
              hundred times over. An unbounded ReLU there can blow up; tanh keeps the state between −1 and 1. The gates (forget, input, output) use
              sigmoid because a gate is a fraction: 0 means block, 1 means let through, and only a 0–1 output can be read that way.
            </li>
            <li>
              <strong>Output layers</strong> are chosen by the answer and the loss together: sigmoid with binary cross-entropy for yes/no, softmax
              with cross-entropy for one class out of many, no activation with squared error for a number.
            </li>
          </ul>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "A sigmoid's slope is at most 0.25. If the gradient were multiplied by 0.25 at each of 5 layers, what share would be left? (four decimals)",
          answer: 0.001,
          tolerance: 0.00005,
          why: "0.25⁵ ≈ 0.00098: about a thousandth, after only five layers.",
        },
        {
          kind: "choice",
          q: "A network must pick one of 10 classes. What goes on its output layer?",
          options: [
            { t: "Softmax: probabilities over the 10 classes that add up to 1.", ok: true, why: "One-of-many answers need softmax." },
            { t: "ReLU", why: "ReLU outputs aren't probabilities and don't add up to 1." },
            { t: "Sigmoid on each class", why: "That's for independent yes/no labels (multi-label), where several can be true at once." },
            { t: "No activation", why: "Raw scores need softmax to become probabilities." },
          ],
        },
        {
          kind: "choice",
          q: "Which activation do most transformers use in their hidden layers?",
          options: [
            { t: "GELU", ok: true, why: "BERT, GPT and vision transformers use GELU (or close relatives like SwiGLU)." },
            { t: "Sigmoid", why: "It would vanish the gradient in such deep models." },
            { t: "Step function", why: "It has no useful slope, so it can't be trained with gradients." },
            { t: "Tanh", why: "Used in RNNs, rarely in transformer layers." },
          ],
        },
        {
          kind: "number",
          q: "A neuron's weights are 0.8, −0.5 and 0.3, its bias is 0.1, and the input is (1, −2, 0.5). After ReLU, what does it pass on?",
          answer: 2.05,
          tolerance: 0.01,
          why: "z = 0.8 + 1 + 0.15 + 0.1 = 2.05. It's positive, so ReLU passes it through unchanged.",
        },
        {
          kind: "choice",
          q: "Why do LSTM gates use the sigmoid rather than ReLU?",
          options: [
            { t: "A gate is a fraction of the signal to let through, and only the sigmoid gives a value between 0 and 1.", ok: true, why: "0 blocks, 1 passes, and anything in between is a dial." },
            { t: "Sigmoid has a bigger slope.", why: "It's smaller (at most 0.25); gates use it for its range, not its slope." },
            { t: "ReLU can't be used in recurrent networks at all.", why: "It can, carefully, but a gate still needs a 0–1 value." },
            { t: "It's cheaper to compute.", why: "ReLU is cheaper; the range is the reason." },
          ],
        },
        { kind: "task", q: "Find the input in the traced layer where ReLU changes nothing at all, and show it with ReLU on.", Sim: TraceSim, check: (s) => s.act === "relu" && s.norm === "none" && s.ex === 2, done: "All three sums are positive for input #3, so ReLU is a straight line there. The bends come from the inputs that switch neurons off." },
        { kind: "task", q: "Find an activation that keeps at least 90% of the gradient through 30 layers.", Sim: ActivationSim, check: (s) => s.depth >= 30 && s.left >= 0.9, done: "ReLU with He initialisation keeps the signal's size. That's much of why deep networks became trainable." },
      ],
      explain: {
        q: "Why did ReLU replace the sigmoid in deep networks?",
        options: [
          { t: "Its slope is 1 for positive inputs, so the learning signal doesn't shrink as it passes back through many layers, while sigmoid's small slope makes it vanish.", verdict: "right", why: "Vanishing gradients were the obstacle; ReLU's slope removes most of it." },
          { t: "It's more like a real neuron.", verdict: "wrong", why: "The sigmoid is closer to a firing rate. ReLU won on trainability." },
          { t: "It's faster to compute.", verdict: "partly", why: "True, and it helps, but the main reason is the gradient." },
          { t: "Its outputs are probabilities.", verdict: "wrong", why: "ReLU outputs any non-negative number; that's the sigmoid's job." },
        ],
      },
      readMore: [
        { title: "Deep Learning, section 6.3: hidden units", by: "Goodfellow, Bengio and Courville (free book)", url: "https://www.deeplearningbook.org/contents/mlp.html" },
        { title: "Gaussian error linear units (GELUs)", by: "Hendrycks and Gimpel (2016)", url: "https://arxiv.org/abs/1606.08415" },
        { title: "Delving deep into rectifiers (He initialisation)", by: "He et al. (2015)", url: "https://arxiv.org/abs/1502.01852" },
      ],
    },

    {
      id: "backprop",
      title: "Passing the blame backwards",
      lead: "Backpropagation: how a network works out which weights to change.",
      history: "The maths of propagating derivatives backwards was worked out several times, by Seppo Linnainmaa in 1970 and Paul Werbos in 1974 among others. David Rumelhart, Geoffrey Hinton and Ronald Williams showed in 1986 that it trains hidden layers to learn useful features, and it has trained essentially every neural network since.",
      gist: [
        "To learn, every weight needs to know how much it contributed to the error.",
        "Backpropagation works that out for all of them in one backward sweep, using the chain rule.",
        "Then gradient descent nudges every weight against its share of the blame, and the loop repeats.",
      ],
      practice: {
        adjust: ["Nothing by hand: frameworks (PyTorch, TensorFlow, JAX) compute the gradients automatically.", "The learning rate, which scales every step backprop proposes."],
        wrong: ["Vanishing gradients: blame shrinks to nothing on its way back through many layers, so early layers stop learning.", "Exploding gradients: it grows instead, and training blows up."],
        notice: ["Watch the size of the gradients per layer during training.", "NaN losses usually mean exploding gradients or too big a learning rate."],
        ask: ["Are the gradients reaching the first layers, or vanishing?", "Should we clip the gradients?"],
      },
      idea: (
        <p>
          A network with a million weights makes a mistake. Which weights should change, and by how much? Backpropagation answers this by passing the
          error backwards: the output layer works out its share of the blame, hands each earlier weight its share, and so on back to the inputs. One
          backward pass gives every weight its gradient.
        </p>
      ),
      example: (
        <>
          <p>A tiny network takes 1, passes it through two weights, and outputs −0.14 when the answer should be 0.8. The error is about −0.94.</p>
          <p>
            The second weight sees it was multiplied by a negative hidden value, so it should change one way; the first weight's blame is that error
            passed back through the second weight and the tanh's slope. A few steps of adjusting both, and the output is 0.8.
          </p>
        </>
      ),
      play: [{ Sim: BackpropSim, try: "Press 'One step of backprop' and watch the blame on each weight shrink as the output approaches 0.80." }],
      how: (
        <>
          <p>The network is a chain of functions, so the chain rule gives each weight's effect on the loss as a product of local slopes. For the tiny network here:</p>
          <Eq says="h = tanh(w₁x), ŷ = w₂h, L = ½(ŷ − y)²">
            ∂L/∂w<sub>2</sub> = (ŷ − y)·h, &nbsp; ∂L/∂w<sub>1</sub> = (ŷ − y)·w<sub>2</sub>·(1 − h²)·x
          </Eq>
          <p>
            Notice the shared factor (ŷ − y): the error is computed once and passed backwards, each layer multiplying by its own local slope. That reuse
            is why backprop costs about the same as one forward pass, however many weights there are.
          </p>
          <p>
            In deep networks that product of slopes can shrink toward zero (sigmoid and tanh flatten out) or grow without limit. ReLU activations,
            careful initialisation, normalisation layers and the skip connections from the vision chapter all exist to keep the blame flowing.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "The output is 0.5, the target 0.8 and the hidden value h is 0.6. For L = ½(ŷ − y)², what is ∂L/∂w₂ = (ŷ − y)·h?",
          answer: -0.18,
          tolerance: 0.001,
          why: "(0.5 − 0.8) × 0.6 = −0.3 × 0.6 = −0.18. Negative, so gradient descent increases w₂.",
        },
        {
          kind: "choice",
          q: "Why is backpropagation efficient?",
          options: [
            { t: "It computes the error once and reuses it as it passes backwards, so all gradients cost about one extra pass.", ok: true, why: "Shared factors are reused, not recomputed per weight." },
            { t: "It only updates a few weights each step.", why: "It computes a gradient for every weight." },
            { t: "It guesses the gradients randomly.", why: "The gradients are exact (for the batch used)." },
            { t: "It skips the hidden layers.", why: "The hidden layers are exactly what it trains." },
          ],
        },
        { kind: "task", q: "Use backprop steps to bring the loss under 0.0005.", Sim: BackpropSim, check: (s) => s.loss < 0.0005, done: "Every step, every weight moved against its share of the blame. A real network does this for millions of weights at once." },
      ],
      explain: {
        q: "How does a neural network know which weights to change?",
        options: [
          { t: "Backpropagation passes the output error backwards with the chain rule, giving every weight its share of the blame; gradient descent then adjusts each one.", verdict: "right", why: "Blame backwards, then a step downhill: that's training." },
          { t: "It tries changing each weight and sees if the error goes down.", verdict: "wrong", why: "That would take millions of trials per step. Backprop gets all the slopes in one pass." },
          { t: "It works out the gradient of the loss.", verdict: "partly", why: "True, but it leaves out how: the chain rule, backwards through the layers." },
          { t: "The programmer sets them.", verdict: "wrong", why: "The weights are learned, not set." },
        ],
      },
      readMore: [
        { title: "What is backpropagation really doing?", by: "3Blue1Brown (video)", url: "https://www.youtube.com/watch?v=Ilg3gGewQ5U" },
        { title: "Calculus on computational graphs: backpropagation", by: "Christopher Olah", url: "https://colah.github.io/posts/2015-08-Backprop/" },
        { title: "The spelled-out intro to neural networks and backpropagation", by: "Andrej Karpathy (video)", url: "https://www.youtube.com/watch?v=VMj-3S1tku0" },
      ],
    },

    {
      id: "normalisation",
      title: "Keeping the numbers in range",
      lead: "Normalisation: batch norm, layer norm, and which network uses which.",
      history: "Standardising inputs is as old as statistics. Sergey Ioffe and Christian Szegedy introduced batch normalisation in 2015, letting very deep CNNs train fast; layer normalisation (Jimmy Ba and colleagues, 2016) followed for RNNs and became part of every transformer; group normalisation (2018) covered small batches.",
      gist: [
        "Through many layers, values drift: slightly too-big weights make them explode, too-small ones make them vanish.",
        "Normalisation re-centres and rescales the values after each layer, so every layer sees numbers in a healthy range.",
        "Batch norm (CNNs) averages across the batch; layer norm (transformers, RNNs) averages within each example; group norm suits small batches.",
      ],
      practice: {
        adjust: [
          "Inputs: always standardise them (the features lesson).",
          "CNNs with decent batches: batch norm. Transformers and RNNs: layer norm (or RMSNorm). Small batches, e.g. big images: group norm.",
          "Where it sits: transformers today put layer norm before each block ('pre-norm'), which trains more stably.",
        ],
        wrong: [
          "Batch norm with tiny batches: the batch statistics are noisy and training suffers.",
          "Forgetting to switch batch norm to its saved statistics at prediction time (model.eval() in PyTorch), so predictions depend on the batch.",
          "Batch norm in a sequence model, where examples differ in length.",
        ],
        notice: ["Predictions that change with the batch they're in: batch norm left in training mode.", "Activations or losses that grow layer by layer early in training."],
        ask: ["Is the model in evaluation mode when we predict?", "What batch size per device, and is batch norm sensible at that size?"],
      },
      idea: (
        <>
          <p>
            Push numbers through twenty layers and small effects compound: weights a little too big make values double and double again; a little too
            small and they fade to nothing. Normalisation steps in after a layer and resets the values to a mean of zero and a spread of one, then lets
            the network learn its own preferred scale. Every layer gets inputs in a range it can work with.
          </p>
          <p>
            It sits between the weighted sum and the activation. A neuron adds up its weighted connections into z; normalisation adjusts that z;
            the activation bends it; the result travels on along the next weights. So a CNN layer reads convolution, then batch norm, then ReLU. A
            transformer block normalises its input first, runs attention or the feed-forward part on it, and adds the result back onto the
            unnormalised input (the skip connection).
          </p>
          <p>
            It changes no weights. It adds two learned numbers per neuron or channel, γ and β, not one per connection. And it cancels the weights'
            overall size: double every weight going into a layer and every z doubles, but so do their mean and spread, so the normalised values come
            out the same. That's how it rescues weights that would otherwise explode.
          </p>
        </>
      ),
      example: (
        <>
          <p>
            A 50-layer image classifier won't train: the loss jumps about, and lowering the learning rate only makes it crawl. Adding batch
            normalisation after each convolution lets it train at a learning rate ten times higher, in a fraction of the epochs.
          </p>
          <p>
            The same team later fine-tunes it with batches of 2 images (they're huge medical scans), and batch norm becomes unstable. Swapping to group
            norm, which doesn't depend on the batch, fixes it.
          </p>
          <p>
            In numbers, with the traced layer from the activations lesson and a batch of four inputs. The first hidden neuron's sums for the four are
            2.05, −0.3, 1.9 and −0.39.
          </p>
          <p>
            Batch norm works down that column, one neuron across the batch: mean 0.82, spread 1.16, so input #1's 2.05 becomes (2.05 − 0.82) / 1.16
            = 1.06. Layer norm works across the row instead, one input across its own neurons: input #1's three sums are 2.05, −1.15 and −1.1, with
            mean −0.07 and spread 1.50, so they become 1.41, −0.72 and −0.69.
          </p>
          <p>
            Both pull the numbers into the same range, but look at what each depends on. Under batch norm, input #1's value depends on the other
            three inputs: put it in a different batch and its answer moves. Under layer norm it depends only on itself. Re-centring also changes
            which neurons fire after ReLU. Input #3's second neuron goes from a faint 0.15 to 0.82 under batch norm, because 0.15 is above that
            neuron's average across the batch.
          </p>
        </>
      ),
      play: [
        { Sim: TraceSim, try: "Pick ReLU, then compare None, Batch norm and Layer norm for input #1 and input #3. Which hidden neurons switch on or off?" },
        { Sim: NormSim, try: "With no normalisation, move the weight size from 1.0 to 2.0. Then try batch norm and layer norm, and shrink the batch to 2 with batch norm." },
      ],
      how: (
        <>
          <p>Every normalisation does the same two steps, differing only in which numbers the mean and spread are taken over:</p>
          <Eq says="μ and σ are a mean and spread; γ and β are learned">
            y = γ · (x − μ) / √(σ² + ε) + β
          </Eq>
          <ul>
            <li>
              <strong>Batch norm</strong>: μ and σ per channel, across the examples in the batch (and the image positions). Great for CNNs; needs a
              reasonable batch; at prediction time uses running averages saved during training.
            </li>
            <li>
              <strong>Layer norm</strong>: per example, across all its features. Independent of the batch and of sequence length, so it's the choice
              for transformers and RNNs. <strong>RMSNorm</strong>, used in many recent language models, skips the mean and only rescales.
            </li>
            <li>
              <strong>Group norm</strong>: per example, across groups of channels; for CNNs with small batches. <strong>Instance norm</strong> (one
              channel at a time) is used in style transfer.
            </li>
          </ul>
          <p>
            The learned γ and β mean nothing is lost: the network can undo the normalisation if that's better. What it gains is stable values, a
            smoother loss to descend, and the freedom to use larger learning rates.
          </p>
          <p>Why each kind of network ends up with its own:</p>
          <ul>
            <li>
              <strong>CNNs</strong> take batch norm's mean for one channel over every image in the batch and every position in the image: 32 images of
              56 × 56 is about 100,000 numbers per average, so the statistics are steady. That fits, because a channel is one filter and should behave
              alike everywhere. Because β already shifts each channel, the convolution before it usually drops its bias. The batch noise even
              regularises a little. When batches shrink to one or two big images, those averages fall apart, and group norm takes over.
            </li>
            <li>
              <strong>Transformers</strong> handle sentences of different lengths padded together, and generate text one token at a time, often with
              a batch of one. Batch statistics make no sense there, so layer norm works on each token by itself, across its few hundred features.
              Putting it first in the block (pre-norm) leaves the skip connection as a clean, unnormalised path back, so the gradient reaches the
              early layers of a 100-layer model. RMSNorm drops the mean and saves a little work.
            </li>
            <li>
              <strong>RNNs</strong> apply the same layer at every time step, and the values drift as the sequence goes on. Batch norm would need
              separate statistics for step 1, step 2 and so on; layer norm just normalises each step of each sequence as it comes.
            </li>
            <li>
              <strong>At prediction time</strong> batch norm can't rely on a batch, so it uses running averages saved during training. Layer and group
              norm compute everything from the example itself and behave identically in training and use.
            </li>
          </ul>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "A unit's values in a batch have mean 4 and standard deviation 2. After normalisation (before γ and β), what does the value 7 become?",
          answer: 1.5,
          tolerance: 0.01,
          why: "(7 − 4) / 2 = 1.5.",
        },
        {
          kind: "choice",
          q: "Which normalisation does a transformer language model use?",
          options: [
            { t: "Layer norm (or RMSNorm): per example, independent of the batch and sequence length.", ok: true, why: "Every transformer block has it." },
            { t: "Batch norm", why: "Statistics across a batch of varying-length sequences work poorly; it's a CNN tool." },
            { t: "None", why: "Without it, deep transformers are very hard to train." },
            { t: "Instance norm", why: "That's for images, mostly style transfer." },
          ],
        },
        {
          kind: "choice",
          q: "A CNN with batch norm gives different predictions for the same image depending on what else is in the batch. Why?",
          options: [
            { t: "It's still in training mode, normalising with the current batch's statistics instead of the saved ones.", ok: true, why: "Switch to evaluation mode for prediction." },
            { t: "The weights change during prediction.", why: "Weights are fixed; the batch statistics are what differ." },
            { t: "Batch norm is random.", why: "It's deterministic given the batch; the batch is the problem." },
            { t: "The images are too big.", why: "Size isn't the cause; mode is." },
          ],
        },
        {
          kind: "choice",
          q: "Why does a convolution followed by batch norm usually have no bias?",
          options: [
            { t: "Batch norm subtracts the mean, which removes any bias, and its own β adds a learned shift back.", ok: true, why: "The bias would be cancelled straight away, so it's wasted weight." },
            { t: "Biases make batch norm slower.", why: "Speed isn't it; the bias is simply cancelled out." },
            { t: "Convolutions can't have biases.", why: "They can, and do when nothing normalises after them." },
            { t: "β is set to zero, so a bias is needed elsewhere.", why: "β is learned, and it takes over the bias's job." },
          ],
        },
        { kind: "task", q: "In the traced layer, use ReLU and the normalisation that gives input #1 the same answer whatever else is in its batch.", Sim: TraceSim, check: (s) => s.act === "relu" && s.norm === "layer" && s.ex === 0, done: "Layer norm uses only input #1's own three sums, so the rest of the batch can't move it." },
        { kind: "task", q: "With weights at 2.0 or more, keep the spread at layer 20 between 0.5 and 2.", Sim: NormSim, check: (s) => s.scale >= 2 && s.last > 0.5 && s.last < 2, done: "Normalisation rescues weights that would otherwise explode." },
      ],
      explain: {
        q: "What does batch normalisation do, and when would you use layer norm instead?",
        options: [
          { t: "It rescales each layer's values to a standard range using statistics from the batch; layer norm does it within each example, so it suits transformers, RNNs and small batches.", verdict: "right", why: "Same idea, different averaging, chosen by the kind of network and batch." },
          { t: "It makes all the weights the same size.", verdict: "wrong", why: "It acts on the values flowing through, not the weights." },
          { t: "It keeps values in a healthy range so deep networks train.", verdict: "partly", why: "That's the purpose, but it misses the batch-versus-example difference that decides which one to use." },
          { t: "It normalises the input data once before training.", verdict: "wrong", why: "That's input standardisation. Batch and layer norm act inside the network, at every layer." },
        ],
      },
      readMore: [
        { title: "Batch normalization", by: "Ioffe and Szegedy (2015)", url: "https://arxiv.org/abs/1502.03167" },
        { title: "Layer normalization", by: "Ba, Kiros and Hinton (2016)", url: "https://arxiv.org/abs/1607.06450" },
        { title: "Group normalization", by: "Wu and He (2018)", url: "https://arxiv.org/abs/1803.08494" },
      ],
    },

    {
      id: "training",
      title: "Teaching a big network",
      lead: "Training deep networks: optimisers, dropout and early stopping.",
      history: "Geoffrey Hinton's group introduced dropout in 2012, the same year AlexNet won ImageNet with deep networks trained on graphics cards. Diederik Kingma and Jimmy Ba's Adam optimiser (2014) became the default way to train them, and early stopping, much older, is still one of the simplest guards against memorising.",
      gist: [
        "Big networks learn fast and memorise fast, so you watch training and validation loss together.",
        "Adaptive optimisers like Adam reach a good place sooner than plain gradient descent.",
        "Dropout and early stopping keep the network from memorising: train for what generalises, then stop.",
      ],
      practice: {
        adjust: ["Optimiser and learning rate (Adam with about 0.001 is a common start).", "Dropout rate (0.1–0.5), weight decay, batch size.", "When to stop: patience in epochs before giving up on improvement."],
        wrong: ["Training too long and keeping the last model instead of the best one.", "A validation set that overlaps the training data.", "Changing several settings at once, so you can't tell what helped."],
        notice: ["Plot both losses every epoch; the gap between them is your overfitting meter."],
        ask: ["At which epoch was validation loss lowest, and is that the model we saved?"],
      },
      idea: (
        <p>
          A deep network has more than enough capacity to memorise its training data. Training is a race: learn the patterns that generalise before
          memorising the noise. So you watch two curves, loss on the training data and loss on held-out data, and use tools that help the first keep
          falling without the second turning back up.
        </p>
      ),
      example: (
        <>
          <p>A team trains a network for 60 epochs with plain gradient descent. Training loss keeps falling; validation loss bottoms out at epoch 30 and climbs after.</p>
          <p>
            Switching to Adam reaches the bottom by epoch 12. Adding dropout keeps the two curves closer together. Early stopping keeps the weights
            from the best epoch instead of the last, and the deployed model is the best one they trained.
          </p>
        </>
      ),
      play: [{ Sim: TrainingSim, try: "Try each switch on its own, then together. Which combination keeps the lowest validation loss?" }],
      how: (
        <>
          <p>
            <strong>Adam</strong> keeps, for every weight, a running average of its recent gradients (momentum) and of their size, and scales each step
            by them, so weights with small, consistent gradients still move:
          </p>
          <Eq says="m and v are running averages of the gradient and its square">
            w ← w − η · m / (√v + ε)
          </Eq>
          <p>
            <strong>Dropout</strong> switches off a random share of neurons on every training step, so no neuron can rely on another particular one
            being there: the network learns redundant, more general features. At prediction time all neurons are used.
          </p>
          <p>
            <strong>Early stopping</strong> checks validation loss each epoch and stops after it hasn't improved for a few epochs (the patience), keeping
            the best weights. Weight decay (regularisation from the foundations chapter), data augmentation and normalisation layers are the other
            everyday tools.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "choice",
          q: "Training loss keeps falling, validation loss started rising ten epochs ago. Which model should you keep?",
          options: [
            { t: "The one from the epoch with the lowest validation loss.", ok: true, why: "That's early stopping: the best generalising weights, not the latest." },
            { t: "The latest one, since its training loss is lowest.", why: "Low training loss here means memorising." },
            { t: "The first one.", why: "It hadn't learned much yet." },
            { t: "An average of all of them.", why: "Some methods average checkpoints, but the late, overfitted ones would drag it down." },
          ],
        },
        {
          kind: "choice",
          q: "What does dropout do during training?",
          options: [
            { t: "Randomly switches off some neurons on each step, so the network can't depend on any one of them.", ok: true, why: "It forces redundant, more general features." },
            { t: "Removes training examples the model gets wrong.", why: "It drops neurons, not data." },
            { t: "Permanently deletes weak neurons.", why: "It's random and temporary; all neurons are used at prediction time." },
            { t: "Lowers the learning rate over time.", why: "That's a learning-rate schedule." },
          ],
        },
        { kind: "task", q: "Find settings where the model you keep has a validation loss under 0.25.", Sim: TrainingSim, check: (s) => s.final < 0.25, done: "Faster optimisation, less memorising, and keeping the best epoch: the everyday recipe." },
      ],
      explain: {
        q: "Why watch validation loss while training a neural network?",
        options: [
          { t: "Training loss always improves; validation loss shows when the network stops learning general patterns and starts memorising, so you know when to stop.", verdict: "right", why: "The gap between the two curves is the warning sign." },
          { t: "To check the code is running.", verdict: "wrong", why: "Any loss would show that. Validation shows generalisation." },
          { t: "To see how good the model is.", verdict: "partly", why: "True, and the point is to see it during training so you can stop at the right time." },
          { t: "Because training loss is unreliable.", verdict: "wrong", why: "It's reliable about the training data; that's exactly why it can't warn you about overfitting." },
        ],
      },
      readMore: [
        { title: "A recipe for training neural networks", by: "Andrej Karpathy", url: "https://karpathy.github.io/2019/04/25/recipe/" },
        { title: "Dropout: a simple way to prevent neural networks from overfitting", by: "Srivastava et al. (2014)", url: "https://jmlr.org/papers/v15/srivastava14a.html" },
        { title: "Adam: a method for stochastic optimization", by: "Kingma and Ba (2014)", url: "https://arxiv.org/abs/1412.6980" },
      ],
    },

    {
      id: "sequences",
      title: "Remembering what came before",
      lead: "Recurrent networks and LSTMs for sequences.",
      history: "Jeffrey Elman's simple recurrent network (1990) read sequences one step at a time with a memory. Sepp Hochreiter and Jürgen Schmidhuber's LSTM (1997) added gates so the memory could last; LSTMs powered speech recognition and translation through the 2010s, until transformers (the language chapter) replaced them for most text.",
      gist: [
        "A recurrent network reads a sequence one step at a time, carrying a memory from step to step.",
        "A plain recurrent network's memory fades (or blows up) quickly, because it's multiplied at every step.",
        "An LSTM's gates decide what to keep and what to forget, so it can remember across long stretches.",
      ],
      practice: {
        adjust: ["Plain RNN, LSTM or GRU; or, for most text today, a transformer.", "How long a stretch of sequence to train on."],
        wrong: ["Plain RNNs forgetting anything more than a few steps back.", "Slow training: steps must be processed in order, so it can't be parallelised the way transformers can."],
        notice: ["Test whether the model uses information from far back (put a key fact early and ask about it late)."],
        ask: ["Would a transformer or a temporal model (like those in the forecasting chapter) do better here?"],
      },
      idea: (
        <p>
          Sentences, sensor readings and prices arrive in order, and what came earlier matters. A recurrent network reads one item at a time and keeps
          a memory it updates each step. The catch is that the memory is pushed through the same weights again and again, and an early signal
          shrinks a little every time, until it's gone.
        </p>
      ),
      example: (
        <>
          <p>"The keys that I left on the kitchen table next to the bowl of oranges … are missing." To choose "are" over "is", the model must remember "keys", fifteen words back.</p>
          <p>
            A plain recurrent network has usually lost it by then. An LSTM's forget gate can stay close to "keep", carrying "keys, plural" all the way
            to the verb.
          </p>
        </>
      ),
      play: [{ Sim: MemorySim, try: "Set the distance to 30 words. How close to 1 must the plain RNN's factor be to remember? What happens just above 1?" }],
      how: (
        <>
          <p>A recurrent network updates a hidden state h from the previous state and the new input:</p>
          <Eq says="the same W and U are used at every step">
            h<sub>t</sub> = tanh( W h<sub>t−1</sub> + U x<sub>t</sub> + b )
          </Eq>
          <p>
            Training it means backpropagating through time, and the gradient for something t steps back is multiplied by W (and the tanh's slope) t
            times. Below 1 it vanishes, above 1 it explodes: the same problem as deep networks, stretched out over time.
          </p>
          <p>
            An <strong>LSTM</strong> adds a separate cell state c, updated by gates (small sigmoid layers between 0 and 1): a forget gate f decides how
            much of the old memory to keep, an input gate what to add. Because the memory is carried by c<sub>t</sub> = f·c<sub>t−1</sub> + …, a forget
            gate near 1 lets it pass almost unchanged over many steps. The GRU is a simpler variant. Transformers sidestep the problem entirely by
            letting every word attend directly to every other.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "A plain RNN keeps 0.8 of its memory each step. What share of a signal is left after 10 steps? (two decimals)",
          answer: 0.11,
          tolerance: 0.005,
          why: "0.8¹⁰ ≈ 0.107: about a tenth, and after 30 steps almost nothing.",
        },
        {
          kind: "choice",
          q: "What does an LSTM's forget gate do?",
          options: [
            { t: "It decides, at each step, how much of the stored memory to keep.", ok: true, why: "Near 1 keeps it; near 0 clears it." },
            { t: "It deletes training examples.", why: "It acts on the memory inside the network, not on data." },
            { t: "It makes the network forget its weights.", why: "Weights stay; the gate controls the running memory." },
            { t: "It speeds up training.", why: "Its job is long memory; LSTMs are slower than plain RNNs." },
          ],
        },
        { kind: "task", q: "Make the LSTM remember at least half the signal 30 words later.", Sim: MemorySim, check: (s) => s.len >= 30 && s.lstm >= 0.5, done: "A gate close to 1 is what lets it carry information over long gaps." },
      ],
      explain: {
        q: "Why were LSTMs invented?",
        options: [
          { t: "Plain recurrent networks forget quickly, because their memory is multiplied at every step; gates let an LSTM keep information over long sequences.", verdict: "right", why: "Vanishing memory was the problem; gated memory the fix." },
          { t: "To process images.", verdict: "wrong", why: "They're for sequences; convolutions handle images." },
          { t: "To make networks deeper.", verdict: "partly", why: "Over time steps they are 'deep', and the gates tackle the same vanishing-gradient problem." },
          { t: "Because transformers were too slow.", verdict: "wrong", why: "LSTMs (1997) came twenty years before transformers." },
        ],
      },
      readMore: [
        { title: "Understanding LSTM networks", by: "Christopher Olah", url: "https://colah.github.io/posts/2015-08-Understanding-LSTMs/" },
        { title: "The unreasonable effectiveness of recurrent neural networks", by: "Andrej Karpathy", url: "https://karpathy.github.io/2015/05/21/rnn-effectiveness/" },
      ],
    },
  ],
};
