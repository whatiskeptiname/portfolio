// Chapter: computer vision with deep learning.
import React from "react";
import { Eq, M, Table } from "../kit";
import { CLIPSim, ConvSim, DepthSignalSim, DiffusionSim, GradCamSim, IoUSim, LatentSim, MaskSim, NMSSim, PatchSim, QuantSim, ReceptiveSim } from "../sims/vision";

export default {
  lessons: [
    {
      id: "convolution",
      title: "How a computer looks at a picture",
      lead: "Pixels, filters and convolution, the building block of vision models.",
      idea: (
        <p>
          To a computer an image is a grid of numbers. A convolution slides a small grid of weights, a filter, across it, and at every position
          multiplies and adds. Choose the weights well and the result lights up wherever the image has a particular pattern: an edge, a corner, a
          stripe. A convolutional network is stacks of these filters, with the weights learned instead of chosen.
        </p>
      ),
      example: (
        <p>
          Hold a stencil with a light-to-dark edge cut into it and slide it over a photo. Wherever the photo has that same edge underneath, the
          match is strong. Do it with a vertical-edge stencil and you get a map of every vertical edge in the picture: door frames, lamp posts, the
          sides of a face. That map is what one filter in the first layer of a vision model produces.
        </p>
      ),
      play: [
        {
          Sim: ConvSim,
          try: "Pick the vertical-edge filter and look at the house: only the sides of the walls show up, white where it goes dark to light and black where it goes light to dark. Everything flat stays grey. Switch to horizontal edges, turn on ReLU, then click a few output pixels to see the sum, and click the filter's cells to build your own.",
        },
      ],
      how: (
        <>
          <Eq says="each output pixel is a weighted sum of the 3×3 patch around it">
            out(x, y) = Σ<sub>i,j</sub> w(i, j) · in(x + i, y + j)
          </Eq>
          <p>A few settings control the result:</p>
          <ul>
            <li>
              <strong>Kernel size</strong>: usually 3×3. Two stacked 3×3 layers see as much as one 5×5, with fewer weights and an extra
              non-linearity.
            </li>
            <li>
              <strong>Stride</strong>: how far the filter jumps each step. Stride 2 halves the output's width and height.
            </li>
            <li>
              <strong>Padding</strong>: zeros around the border so the output keeps the input's size (as in the simulation).
            </li>
            <li>
              <strong>Channels</strong>: a colour image has 3 input channels, so each filter is really 3×3×3. A layer with 64 filters outputs 64
              feature maps.
            </li>
          </ul>
          <p>
            After each convolution comes a non-linearity, usually ReLU (keep positives, zero the rest), and every so often a pooling step that
            shrinks the maps. Early layers end up detecting edges and colours, middle layers textures and parts, and late layers whole objects.
          </p>
          <p>
            Why not a plain fully connected network? A 224×224 colour image has 150,528 inputs; one fully connected layer of 1,000 units would need
            150 million weights. A convolution reuses the same few weights at every position, which also means a cat in the corner is detected the
            same way as a cat in the middle.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "task",
          q: "Find or build a filter that responds strongly to horizontal edges (2 or more) and barely to vertical ones (under 0.5).",
          Sim: ConvSim,
          check: (s) => s.horizontal >= 2 && s.vertical < 0.5,
          done: "Notice the pattern: negative weights on one side, positive on the other, along the direction the brightness changes.",
        },
        {
          kind: "number",
          q: "A convolution layer takes a 3-channel image and has 16 filters of size 3×3. How many weights does it have, not counting biases?",
          answer: 432,
          tolerance: 0,
          why: "Each filter is 3 × 3 × 3 = 27 weights, and there are 16 filters: 27 × 16 = 432. The same 432 numbers are used at every position of the image.",
        },
        {
          kind: "choice",
          q: "Why do convolutional layers need far fewer weights than fully connected ones on images?",
          options: [
            { t: "The same small filter is reused at every position in the image.", ok: true, why: "Right. Weight sharing is the whole trick, and it also makes detection work anywhere in the image." },
            { t: "They only look at grayscale images.", why: "They handle any number of channels." },
            { t: "They skip half the pixels.", why: "Stride can skip positions, but that's not where the savings come from." },
            { t: "They don't use weights; the filters are fixed.", why: "The filters are the weights, and they're learned." },
          ],
        },
      ],
      explain: {
        q: "A friend asks what a convolutional layer actually does. Which answer would you give?",
        options: [
          {
            t: "It slides a small learned pattern-detector across the whole image and records how strongly each spot matches. Stacking many layers builds up from edges to shapes to objects.",
            verdict: "right",
            why: "The mechanism and why stacking matters, in two sentences.",
          },
          {
            t: "It blurs the image so the model can focus on the important parts.",
            verdict: "wrong",
            why: "A blur is one possible filter, but layers learn all sorts of detectors.",
          },
          {
            t: "It looks at every pixel and decides what object it belongs to.",
            verdict: "wrong",
            why: "That's closer to segmentation, a whole task built from many layers.",
          },
          {
            t: "It multiplies the image by a matrix of weights.",
            verdict: "partly",
            why: "Technically it's a (very structured) linear operation, but the friend learns nothing about the sliding, local, shared nature that makes it work.",
          },
        ],
      },
      readMore: [
        { title: "Image kernels explained visually", by: "Setosa (interactive)", url: "https://setosa.io/ev/image-kernels/" },
        { title: "CNN Explainer", by: "Georgia Tech (interactive)", url: "https://poloclub.github.io/cnn-explainer/" },
        { title: "Convolutional neural networks", by: "Stanford CS231n notes", url: "https://cs231n.github.io/convolutional-networks/" },
        { title: "Dive into Deep Learning, convolutions chapter", by: "Zhang et al. (free book with code)", url: "https://d2l.ai/chapter_convolutional-neural-networks/index.html" },
      ],
    },

    {
      id: "deep-networks",
      title: "Going deeper",
      lead: "From LeNet to ResNet: skip connections, batch normalisation and transfer learning.",
      idea: (
        <p>
          Deeper networks can learn richer features, but past about twenty layers plain networks got worse, not better: the learning signal faded
          as it travelled back through every layer. ResNet's fix was a shortcut: let each block add its output to its input. The signal now has a
          direct path back, and networks with a hundred layers train fine.
        </p>
      ),
      example: (
        <p>
          Picture a message passed along a line of fifty people, each repeating it a little more quietly. By the end, nobody can hear it. Now give
          everyone a copy of the original note to pass along as well, so each person only has to add their own small correction. However long the
          line, the message survives. That's a skip connection.
        </p>
      ),
      play: [
        {
          Sim: DepthSignalSim,
          try: "With skip connections off, add layers and watch the first layers' bars turn red: almost no signal reaches them, so they barely learn. Turn skip connections on.",
        },
      ],
      how: (
        <>
          <Table
            head={["Network", "Year", "What it added"]}
            rows={[
              ["LeNet", "1998", "convolution, pooling and a classifier, for handwritten digits"],
              ["AlexNet", "2012", "ReLU, dropout and GPUs; won ImageNet by a wide margin"],
              ["VGG", "2014", "only 3×3 convolutions, stacked 16 to 19 deep"],
              ["Inception", "2014", "parallel filters of several sizes in each block"],
              ["ResNet", "2015", "skip connections; 50 to 152 layers"],
              ["MobileNet", "2017", "depthwise separable convolutions for phones"],
              ["EfficientNet", "2019", "scales depth, width and resolution together"],
            ]}
          />
          <Eq says="a residual block learns only the change F(x) to make to its input">y = F(x) + x</Eq>
          <p>
            When the gradient flows back through <M>y = F(x) + x</M>, the <M>+ x</M> path passes it straight through, so it can't vanish however
            many blocks there are. And if a block has nothing useful to add, it can learn <M>F(x) ≈ 0</M> and get out of the way.
          </p>
          <p>
            <strong>Batch normalisation</strong> rescales each layer's outputs to zero mean and unit variance using the current batch's statistics,
            then lets the network learn its own scale and shift. Training tolerates higher learning rates and converges faster. At inference it
            switches to running averages collected during training, which is why forgetting <M>model.eval()</M> in PyTorch gives odd results.
          </p>
          <p>
            <strong>Transfer learning</strong>: a network trained on ImageNet's 1.2 million images has already learned general features. For a new
            task with little data, freeze the backbone and replace only the final layer. With more data, or a task far from everyday photos (X-rays,
            satellite images), unfreeze some or all layers and fine-tune with a small learning rate.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "task",
          q: "Build a network of at least 40 layers whose first layer still receives at least half of the learning signal.",
          Sim: DepthSignalSim,
          check: (s) => s.layers >= 40 && s.first >= 0.5,
          done: "Skip connections keep the signal near full strength at any depth. Without them, it falls by many orders of magnitude.",
        },
        {
          kind: "choice",
          q: "You have 300 labelled photos of three kinds of plant disease. What's the most sensible start?",
          options: [
            { t: "Take an ImageNet-pretrained network, freeze the backbone, and train a new final layer.", ok: true, why: "Right. 300 images are far too few to train a deep network from scratch, but plenty to fit a new head on good features." },
            { t: "Train a ResNet-152 from scratch.", why: "With 300 images it would memorise them. Pretrained features are the shortcut." },
            { t: "Fine-tune every layer with a large learning rate.", why: "A large rate would wreck the pretrained features. If you fine-tune, use a small rate." },
            { t: "Use a fully connected network on raw pixels.", why: "That needs far more data and ignores everything convolutions are good at." },
          ],
        },
        {
          kind: "choice",
          q: "A model with batch normalisation works well in training but gives poor predictions one image at a time in production. A likely cause?",
          options: [
            { t: "It's still in training mode, normalising each single image with its own statistics instead of the running averages.", ok: true, why: "Right. Switch to evaluation mode (model.eval() in PyTorch)." },
            { t: "Batch normalisation only works on GPUs.", why: "It works anywhere." },
            { t: "The model needs batch sizes of exactly 32.", why: "In evaluation mode the batch size doesn't matter." },
            { t: "Skip connections are missing.", why: "That's a training problem, not an inference one." },
          ],
        },
      ],
      explain: {
        q: "How would you explain why ResNets can be so deep?",
        options: [
          {
            t: "Each block adds a correction to its input instead of replacing it, so there's always a direct path for the learning signal to flow back. Extra blocks can't make things much worse, because they can learn to add nothing.",
            verdict: "right",
            why: "Both reasons: gradient flow, and blocks that can default to doing nothing.",
          },
          {
            t: "They use smaller filters, so each layer is cheaper.",
            verdict: "wrong",
            why: "Cheaper layers make depth affordable, but they don't make it trainable.",
          },
          {
            t: "Skip connections help the gradient flow.",
            verdict: "partly",
            why: "True, but a friend would need to hear why: the shortcut passes the signal straight through.",
          },
          {
            t: "They use batch normalisation, which prevents overfitting.",
            verdict: "wrong",
            why: "Batch norm helps training, and plain networks used it too. It wasn't enough on its own.",
          },
        ],
      },
      readMore: [
        { title: "Deep residual learning for image recognition", by: "He et al. (the ResNet paper)", url: "https://arxiv.org/abs/1512.03385" },
        { title: "Batch normalization", by: "Ioffe and Szegedy (paper)", url: "https://arxiv.org/abs/1502.03167" },
        { title: "Transfer learning", by: "Stanford CS231n notes", url: "https://cs231n.github.io/transfer-learning/" },
        { title: "torchvision models", by: "PyTorch documentation", url: "https://pytorch.org/vision/stable/models.html" },
      ],
    },

    {
      id: "detection",
      title: "Finding things",
      lead: "Object detection: boxes, IoU, non-maximum suppression and mAP.",
      idea: (
        <p>
          Classification says what's in a picture. Detection says what, and where: a box and a label for every object. Detectors make many
          overlapping guesses and then clean them up. Judging them needs one idea: how much does a predicted box overlap the true one?
        </p>
      ),
      example: (
        <p>
          A self-checkout camera has to find every item on the scanner, not just say "groceries". It draws a box around each one. Usually it first
          proposes several boxes for the same apple, slightly shifted, with different confidence scores. Non-maximum suppression keeps the most
          confident and deletes the ones that overlap it too much. Too strict, and two apples touching each other become one.
        </p>
      ),
      play: [
        {
          Sim: IoUSim,
          try: "Drag the orange box onto the car and resize it. Notice how hard it is to reach 0.75, and how quickly IoU falls when the box is a bit too big.",
        },
        {
          Sim: NMSSim,
          try: "Step through at 0.5 first. Then try 0.2: the two people overlap enough that one gets deleted. Then 0.8: duplicates survive.",
        },
      ],
      how: (
        <>
          <Eq says="intersection over union: 1 for a perfect box, 0 for no overlap">IoU = area of overlap / area of union</Eq>
          <p>
            A detection counts as correct if its IoU with an unclaimed true box clears a threshold, usually 0.5. <strong>Average precision</strong>{" "}
            (AP) is the area under the precision–recall curve as you lower the confidence threshold; <strong>mAP</strong> averages it over classes.
            COCO's main number, mAP@0.5:0.95, also averages over IoU thresholds from 0.5 to 0.95, so it rewards tight boxes.
          </p>
          <Table
            head={["Family", "How it works", "Examples"]}
            rows={[
              ["Two-stage", "first propose regions likely to contain objects, then classify and refine each", "R-CNN → Fast R-CNN → Faster R-CNN"],
              ["One-stage", "predict boxes and classes in one pass over a grid", "YOLO, SSD, RetinaNet"],
              ["Set prediction", "a transformer outputs a fixed set of boxes, matched one-to-one to the truth, so no NMS", "DETR"],
            ]}
          />
          <p>A few ideas that come up everywhere:</p>
          <ul>
            <li>
              <strong>Anchors</strong>: preset boxes of several sizes and shapes at each location; the network predicts adjustments to them.
            </li>
            <li>
              <strong>Region Proposal Network</strong>: Faster R-CNN's learned replacement for hand-made region proposals, with RoI Align to crop
              features for each proposal precisely.
            </li>
            <li>
              <strong>Feature pyramids</strong> (FPN): detect small objects on high-resolution maps and large ones on coarse maps, from one backbone
              pass.
            </li>
            <li>
              <strong>Focal loss</strong> (RetinaNet): most candidate boxes are easy background; focal loss turns down their weight so training
              concentrates on the hard ones.
            </li>
          </ul>
        </>
      ),
      quiz: [
        {
          kind: "task",
          q: "Place the box well enough that it would count as correct even under the strict 0.75 IoU threshold.",
          Sim: IoUSim,
          check: (s) => s.iou >= 0.75,
          done: "Tight boxes take care, which is why mAP@0.5:0.95 is much harsher than mAP@0.5.",
        },
        {
          kind: "number",
          q: "Two boxes of area 100 overlap in an area of 50. What is their IoU? Give a decimal.",
          answer: 0.333,
          tolerance: 0.01,
          why: "Union = 100 + 100 − 50 = 150, so IoU = 50 / 150 = 1/3, about 0.33.",
        },
        {
          kind: "task",
          q: "Find a suppression threshold that leaves exactly one box per person, and run NMS to the end.",
          Sim: NMSSim,
          check: (s) => s.finished && s.kept === 2,
          done: "Between about 0.3 and 0.6 here. Lower merges the two people; higher keeps duplicates.",
        },
      ],
      explain: {
        q: "How would you explain non-maximum suppression?",
        options: [
          {
            t: "The detector usually fires several times on the same object. NMS keeps the most confident box, deletes any box that overlaps it too much, and repeats with what's left.",
            verdict: "right",
            why: "The problem and the algorithm, in two sentences.",
          },
          {
            t: "It removes boxes with low confidence.",
            verdict: "partly",
            why: "A confidence cut-off is a separate step. NMS removes boxes for overlapping a better one, whatever their own confidence.",
          },
          {
            t: "It merges overlapping boxes into their average.",
            verdict: "wrong",
            why: "That's a different technique (weighted box fusion). NMS deletes, it doesn't merge.",
          },
          {
            t: "It makes the boxes smaller so they fit the object.",
            verdict: "wrong",
            why: "Box refinement is done by the network's regression head, not NMS.",
          },
        ],
      },
      readMore: [
        { title: "Faster R-CNN", by: "Ren et al. (paper)", url: "https://arxiv.org/abs/1506.01497" },
        { title: "You Only Look Once (YOLO)", by: "Redmon et al. (paper)", url: "https://arxiv.org/abs/1506.02640" },
        { title: "Focal loss for dense object detection", by: "Lin et al. (RetinaNet paper)", url: "https://arxiv.org/abs/1708.02002" },
        { title: "End-to-end object detection with transformers", by: "Carion et al. (DETR paper)", url: "https://arxiv.org/abs/2005.12872" },
        { title: "Ultralytics YOLO", by: "documentation", url: "https://docs.ultralytics.com/" },
      ],
    },

    {
      id: "segmentation",
      title: "Outlining every pixel",
      lead: "Semantic, instance and panoptic segmentation, U-Net, dilated convolutions and SAM.",
      idea: (
        <p>
          Boxes are rough: a box around a person also contains the wall behind them. Segmentation labels every pixel. The challenge is that
          networks shrink images as they go deeper to see more context, and segmentation needs the full-resolution answer back. The best designs
          see widely without forgetting fine detail.
        </p>
      ),
      example: (
        <p>
          A photo-editing app's "remove background" button needs to know exactly which pixels are the person, down to strands of hair. A
          self-driving car needs to know which pixels are road. A surgeon's assistant needs the outline of an organ in a scan. Same task, three
          different stakes.
        </p>
      ),
      play: [
        {
          Sim: MaskSim,
          try: "Step through the five tasks on the same scene. Notice what changes between semantic and instance: whether the two cars get one colour or two.",
        },
        {
          Sim: ReceptiveSim,
          try: "With all dilations at 1, three layers see 7×7. Raise the dilations to 1, 2 and 4: the same 27 weights now see 15×15, with no downsampling.",
        },
      ],
      how: (
        <>
          <Table
            head={["Task", "Output", "Two cars are…"]}
            rows={[
              ["Semantic", "a class for every pixel", "the same colour: both 'car'"],
              ["Instance", "a separate mask for every object", "different colours: car 1 and car 2"],
              ["Panoptic", "both: objects as instances, background ('stuff' like road, sky) as classes", "different colours, and the road labelled too"],
            ]}
          />
          <p>Architectures:</p>
          <ul>
            <li>
              <strong>FCN</strong>: replace a classifier's final layers with 1×1 convolutions and upsample the coarse output back to full size.
              Blurry edges.
            </li>
            <li>
              <strong>U-Net</strong>: an encoder that shrinks, a decoder that grows, and skip connections that pass each encoder level's detailed
              features straight across to the matching decoder level. Sharp edges from little data; the standard in medical imaging.
            </li>
            <li>
              <strong>DeepLab</strong>: dilated (atrous) convolutions widen the field of view without shrinking the map, and ASPP runs several
              dilation rates in parallel to capture context at several scales.
            </li>
            <li>
              <strong>Mask R-CNN</strong>: Faster R-CNN plus a small branch that predicts a mask inside each detected box, using RoI Align for
              pixel-accurate crops.
            </li>
            <li>
              <strong>SAM</strong> (Segment Anything): a large image encoder plus a prompt encoder plus a light mask decoder. Click a point or draw a
              box and it returns a mask, for object types it was never specifically trained on.
            </li>
          </ul>
          <p>
            Segmentation is scored by IoU per class (averaged into mIoU) or the Dice coefficient, <M>2|A∩B| / (|A| + |B|)</M>, which is popular in
            medicine. Dice loss handles the common case where the object is a tiny fraction of the image.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "task",
          q: "Using only three 3×3 layers, give the centre pixel a field of view of at least 15×15.",
          Sim: ReceptiveSim,
          check: (s) => s.rf >= 15,
          done: "Dilations of 1, 2 and 4 cover 15×15 with three layers; plain layers would need seven.",
        },
        {
          kind: "choice",
          q: "In a U-Net, what do the skip connections between encoder and decoder provide?",
          options: [
            { t: "Fine spatial detail from the encoder, lost during downsampling, so the decoder can draw sharp boundaries.", ok: true, why: "Right. The decoder knows what is there from deep layers, and where exactly from the skips." },
            { t: "A shortcut for gradients, as in ResNet, and nothing else.", why: "They do help gradients, but their main job is passing detail across." },
            { t: "Extra training data.", why: "They pass features, not data." },
            { t: "They let the model skip the decoder at inference.", why: "The decoder always runs; it produces the mask." },
          ],
        },
        {
          kind: "choice",
          q: "A crowd photo needs a separate outline for each person. Which task is that?",
          options: [
            { t: "Instance segmentation", ok: true, why: "Right. One mask per object, even when they're the same class." },
            { t: "Semantic segmentation", why: "That would give every person the same 'person' label, merged into one blob." },
            { t: "Object detection", why: "Detection gives boxes, not outlines." },
            { t: "Image classification", why: "That gives one label for the whole photo." },
          ],
        },
      ],
      explain: {
        q: "Which explanation of the difference between semantic and instance segmentation is best?",
        options: [
          {
            t: "Semantic segmentation answers 'what kind of thing is each pixel'; instance segmentation also answers 'which particular object', so two cars side by side get separate outlines.",
            verdict: "right",
            why: "Clear, and the side-by-side cars make the difference concrete.",
          },
          {
            t: "Instance segmentation is more accurate.",
            verdict: "wrong",
            why: "It answers a different question; accuracy isn't the difference.",
          },
          {
            t: "Semantic segmentation uses boxes, instance segmentation uses masks.",
            verdict: "wrong",
            why: "Both produce masks. Boxes are detection.",
          },
          {
            t: "Instance segmentation separates objects; semantic doesn't.",
            verdict: "partly",
            why: "Right, but it leaves out what semantic does do: it labels everything, including road and sky.",
          },
        ],
      },
      readMore: [
        { title: "U-Net", by: "Ronneberger et al. (paper)", url: "https://arxiv.org/abs/1505.04597" },
        { title: "DeepLabv3+", by: "Chen et al. (paper)", url: "https://arxiv.org/abs/1802.02611" },
        { title: "Segment Anything", by: "Kirillov et al. (paper)", url: "https://arxiv.org/abs/2304.02643" },
        { title: "Semantic segmentation", by: "Dive into Deep Learning", url: "https://d2l.ai/chapter_computer-vision/semantic-segmentation-and-dataset.html" },
      ],
    },

    {
      id: "generative",
      title: "Making new images",
      lead: "Autoencoders, GANs and diffusion models.",
      idea: (
        <p>
          Recognising pictures means squeezing them down to a few meaningful numbers. Generating them runs that in reverse: start from some
          numbers and expand them into pixels. The three big families differ in how they learn the expansion: VAEs learn a smooth map of compressed
          codes, GANs learn by trying to fool a critic, and diffusion models learn to remove noise one small step at a time.
        </p>
      ),
      example: (
        <p>
          An artist can sketch a face from a description, "rounder, older, smiling", because they've internalised what faces look like. A VAE
          learns a small space where each direction means something like that. A diffusion model works more like restoring a damaged photograph,
          thousands of times over: given a noisy image, guess the noise and take it away. Start from pure static and repeat, and a new picture
          appears.
        </p>
      ),
      play: [
        {
          Sim: LatentSim,
          try: "Drag across the latent square. Every point gives a valid shape, and small moves give small changes. That smoothness is what a VAE's training aims for.",
        },
        {
          Sim: DiffusionSim,
          try: "Drag the step from 0 to 1000 and watch the smiley dissolve into noise. Then press denoise to run it backwards.",
        },
      ],
      how: (
        <>
          <p>
            <strong>Variational autoencoder (VAE)</strong>: the encoder outputs a mean μ and spread σ instead of a single point, and the decoder
            gets a sample <M>z = μ + σ·ε</M> with ε random (the reparameterisation trick, which keeps sampling differentiable).
          </p>
          <Eq says="reconstruct well, but keep the codes close to a standard normal so the space has no holes">
            loss = reconstruction error + β · KL(q(z|x) ‖ N(0, I))
          </Eq>
          <p>
            <strong>GAN</strong>: a generator turns noise into images; a discriminator tries to tell them from real ones; each trains against the
            other. Sharp results, but training is unstable, and mode collapse (the generator finds a few images that fool the critic and makes only
            those) is common. DCGAN, CycleGAN (translating between styles without paired examples) and StyleGAN are landmarks.
          </p>
          <p>
            <strong>Diffusion (DDPM)</strong>: the forward process adds a little Gaussian noise for T steps, with a fixed schedule:
          </p>
          <Eq says="you can jump straight to any step t; ᾱ_t shrinks from 1 towards 0">
            x<sub>t</sub> = √ᾱ<sub>t</sub> · x<sub>0</sub> + √(1 − ᾱ<sub>t</sub>) · ε
          </Eq>
          <p>
            A U-Net is trained to predict ε from <M>x_t</M> and <M>t</M>. To generate, start from pure noise and use the network to remove a little
            predicted noise at each step. Stable Diffusion does this in a VAE's compressed latent space rather than on pixels, which makes it much
            cheaper, and steers it with text through cross-attention.
          </p>
          <p>
            Generated images are scored with <strong>FID</strong> (Fréchet Inception Distance): pass real and generated images through an
            Inception network and compare the two clouds of features. Lower is better. It captures realism and variety better than pixel-level
            error.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "task",
          q: "Find the first noising step where less than 10% of the original signal remains.",
          Sim: DiffusionSim,
          check: (s) => s.signal < 0.1,
          done: "Around step 680 with this schedule. The rest of the 1000 steps take it the last bit of the way to pure noise.",
        },
        {
          kind: "choice",
          q: "What does the network in a diffusion model learn to predict?",
          options: [
            { t: "The noise that was added to the image at a given step", ok: true, why: "Right. Remove the predicted noise, a step at a time, and an image emerges." },
            { t: "Whether an image is real or fake", why: "That's a GAN's discriminator." },
            { t: "A mean and spread for the latent code", why: "That's a VAE's encoder." },
            { t: "The final image in one step", why: "Diffusion works in many small steps; that's what makes it stable." },
          ],
        },
        {
          kind: "multi",
          q: "Which are true? Pick all that apply.",
          options: [
            { t: "Mode collapse is a classic failure of GANs.", ok: true, why: "The generator finds a few outputs that fool the critic and sticks to them." },
            { t: "The KL term in a VAE keeps the latent space smooth and filled in.", ok: true, why: "Without it, codes scatter and points between them decode to nonsense." },
            { t: "Stable Diffusion runs the diffusion process in a compressed latent space.", ok: true, why: "Hence 'latent diffusion': far cheaper than pixels." },
            { t: "A lower FID means worse images.", why: "Lower FID means the generated features look more like real ones: better." },
          ],
        },
      ],
      explain: {
        q: "How would you explain diffusion models to a friend?",
        options: [
          {
            t: "You train a network to clean up slightly noisy images. Then you start from pure noise and ask it to clean up, over and over. Each pass removes a little noise, and a brand-new image appears.",
            verdict: "right",
            why: "The training and the generation, without a single formula.",
          },
          {
            t: "It copies parts of the training images and blends them together.",
            verdict: "wrong",
            why: "It learns to remove noise, not to collage. (It can occasionally memorise training images, which is a known issue, but that's not how it works.)",
          },
          {
            t: "It's a GAN that uses noise.",
            verdict: "wrong",
            why: "GANs also start from noise, but there's no discriminator in a diffusion model.",
          },
          {
            t: "It slowly adds noise to an image.",
            verdict: "partly",
            why: "That's the forward process, used to make training examples. Generation runs the other way.",
          },
        ],
      },
      readMore: [
        { title: "What are diffusion models?", by: "Lilian Weng (blog post)", url: "https://lilianweng.github.io/posts/2021-07-11-diffusion-models/" },
        { title: "Denoising diffusion probabilistic models", by: "Ho et al. (paper)", url: "https://arxiv.org/abs/2006.11239" },
        { title: "Auto-encoding variational Bayes", by: "Kingma and Welling (the VAE paper)", url: "https://arxiv.org/abs/1312.6114" },
        { title: "Generative adversarial networks", by: "Goodfellow et al. (paper)", url: "https://arxiv.org/abs/1406.2661" },
        { title: "Understanding Deep Learning", by: "Simon Prince (free book; chapters on VAEs and diffusion)", url: "https://udlbook.github.io/udlbook/" },
      ],
    },

    {
      id: "transformers",
      title: "Attention instead of convolution",
      lead: "Vision transformers, Swin, self-supervised learning and CLIP.",
      idea: (
        <p>
          A convolution only looks at a pixel's neighbours; seeing across the image takes many layers. A vision transformer cuts the image into
          patches, treats them like words in a sentence, and lets every patch look at every other patch from the very first layer. It needs more
          data to learn what a CNN gets for free, but with enough data it matches or beats them.
        </p>
      ),
      example: (
        <p>
          To decide whether a small grey shape is a mouse or a stone, it helps to notice the cat staring at it from across the room. A CNN only
          connects the two after many layers. In a transformer, the patch with the grey shape can attend directly to the patch with the cat in
          layer one.
        </p>
      ),
      play: [
        {
          Sim: PatchSim,
          try: "Click different patches: sky attends to sky, roof to wall. Lower the temperature to make attention sharp, raise it to spread it evenly.",
        },
        {
          Sim: CLIPSim,
          try: "Pick each image and watch which caption wins. Notice the dog caption scores fairly high for the cat: the embeddings place them near each other.",
        },
      ],
      how: (
        <>
          <p>The ViT recipe:</p>
          <ol>
            <li>Split the image into 16×16 patches (a 224×224 image gives 196).</li>
            <li>Flatten each patch and project it to an embedding vector.</li>
            <li>Add a learned position embedding to each, and prepend a learnable [CLS] token.</li>
            <li>Run standard transformer layers: multi-head self-attention, then a small MLP, each with a skip connection.</li>
            <li>Classify from the [CLS] token's final vector.</li>
          </ol>
          <Eq says="each patch's query is compared with every patch's key; the scores weight the values">attention(Q, K, V) = softmax(QKᵀ / √d) V</Eq>
          <p>
            Attention costs grow with the square of the number of patches. <strong>Swin Transformer</strong> attends within local windows and
            shifts the windows between layers so information still spreads, merging patches as it goes to produce multi-scale features like a CNN.
            That made transformers practical for detection and segmentation.
          </p>
          <p>Learning without labels:</p>
          <ul>
            <li>
              <strong>MAE</strong> (masked autoencoder): hide 75% of the patches and train the model to reconstruct them.
            </li>
            <li>
              <strong>DINO</strong>: a student network matches a slowly updated teacher's output on different crops of the same image. Its attention
              maps end up outlining objects without ever being told what objects are.
            </li>
          </ul>
          <p>
            <strong>CLIP</strong> trains an image encoder and a text encoder together on 400 million image–caption pairs, pulling matching pairs
            close in a shared space and pushing others apart. To classify with no training at all, embed "a photo of a [class]" for each class and
            pick the one closest to the image.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "A 224×224 image is split into 16×16 patches. How many patch tokens does the transformer see (not counting [CLS])?",
          answer: 196,
          tolerance: 0,
          why: "224 / 16 = 14 patches per side, and 14 × 14 = 196.",
        },
        {
          kind: "choice",
          q: "Why do vision transformers typically need more training data than CNNs?",
          options: [
            { t: "They lack the CNN's built-in assumptions that nearby pixels matter most and that patterns look the same anywhere, so they must learn these from data.", ok: true, why: "Right. Those inductive biases are free in a CNN; a ViT has to discover them." },
            { t: "They have no position information.", why: "They do, through position embeddings." },
            { t: "Attention can't be trained with gradient descent.", why: "It can and is." },
            { t: "They only work on text.", why: "That's the point of ViT: the same architecture works on image patches." },
          ],
        },
        {
          kind: "choice",
          q: "How does CLIP classify an image into classes it was never explicitly trained on?",
          options: [
            { t: "It embeds a caption for each class, like 'a photo of a zebra', and picks the one most similar to the image's embedding.", ok: true, why: "Right. The text encoder turns any class name into a classifier." },
            { t: "It searches the internet for similar images.", why: "Everything happens inside the two encoders." },
            { t: "It fine-tunes on the new classes first.", why: "Zero-shot means no fine-tuning." },
            { t: "It uses a fixed list of 1,000 ImageNet classes.", why: "It can use any classes you can describe in words." },
          ],
        },
      ],
      explain: {
        q: "Explain self-attention in a vision transformer to a friend.",
        options: [
          {
            t: "Each patch of the image asks every other patch how relevant it is, then builds its new description as a weighted mix of the others, with more weight on the relevant ones. So context from anywhere in the image arrives in one step.",
            verdict: "right",
            why: "It covers the comparison, the weighted mix, and why it beats local convolutions on context.",
          },
          {
            t: "The model pays attention to the most important part of the image and ignores the rest.",
            verdict: "partly",
            why: "Attention does weight some patches more, but every patch does this for itself, and nothing is fully ignored.",
          },
          {
            t: "It's a convolution with a very large kernel.",
            verdict: "wrong",
            why: "A convolution's weights are fixed per position; attention's weights depend on the content.",
          },
          {
            t: "It focuses the camera on the object.",
            verdict: "wrong",
            why: "Nothing physical happens; it's all a weighting of features.",
          },
        ],
      },
      readMore: [
        { title: "An image is worth 16×16 words", by: "Dosovitskiy et al. (the ViT paper; short and readable)", url: "https://arxiv.org/abs/2010.11929" },
        { title: "The illustrated transformer", by: "Jay Alammar (blog post)", url: "https://jalammar.github.io/illustrated-transformer/" },
        { title: "Swin Transformer", by: "Liu et al. (paper)", url: "https://arxiv.org/abs/2103.14030" },
        { title: "Masked autoencoders are scalable vision learners", by: "He et al. (MAE paper)", url: "https://arxiv.org/abs/2111.06377" },
        { title: "Learning transferable visual models from natural language supervision", by: "Radford et al. (the CLIP paper)", url: "https://arxiv.org/abs/2103.00020" },
      ],
    },

    {
      id: "shipping",
      title: "Seeing what it saw, and shipping it",
      lead: "Grad-CAM explanations, ONNX export and quantisation.",
      idea: (
        <p>
          Before you trust a vision model, check what it's looking at: a heat map of the pixels that drove its answer. Before you ship it, make it
          small and fast enough for where it'll run. Exporting to a standard format and storing weights in 8 bits instead of 32 often makes it four
          times smaller and several times faster, for a small cost in accuracy.
        </p>
      ),
      example: (
        <p>
          A famous story: a model told huskies from wolves with excellent accuracy. A heat map showed it was looking at the snow, not the animal:
          most wolf photos had snow in them. On a camera at a farm gate, the same model must also run at 30 frames per second on a small board, which
          is where quantisation comes in.
        </p>
      ),
      play: [
        {
          Sim: GradCamSim,
          try: "Switch between explaining 'dog' and 'ball'. The same feature maps get different weights, so the heat lands in different places.",
        },
        {
          Sim: QuantSim,
          try: "Lower the bits from 8 to 4 and watch the ordinary weights collapse to a few values. Then turn on calibration: clipping the rare huge weights spends the levels where most weights are.",
        },
      ],
      how: (
        <>
          <p>
            <strong>Grad-CAM</strong>: take the last convolutional layer's feature maps. Compute the gradient of the chosen class's score with
            respect to each map, and average it over the map to get one weight per channel. Weight the maps, add them up, apply ReLU (only keep
            evidence for the class), and upsample to the image size.
          </p>
          <Eq says="α_k: the average gradient for channel k; A^k: that channel's feature map">heat map = ReLU(Σ<sub>k</sub> α<sub>k</sub> A<sup>k</sup>)</Eq>
          <p>Getting a model into production:</p>
          <ul>
            <li>
              <strong>Export</strong>: <M>torch.onnx.export</M> writes the network to ONNX, a format that ONNX Runtime, TensorRT, OpenVINO and
              mobile runtimes can all load. Check the exported model gives the same outputs as the original on a few real inputs.
            </li>
            <li>
              <strong>Quantise</strong>: store weights (and often activations) as 8-bit integers. Post-training quantisation needs only a few
              hundred calibration images to pick value ranges; quantisation-aware training recovers more accuracy when that isn't enough.
            </li>
            <li>
              <strong>Measure</strong> on the real device: latency (per frame), throughput (frames per second with batching), memory, and accuracy
              after each change. A 30 fps budget is 33 ms for everything, including pre- and post-processing.
            </li>
          </ul>
          <p>
            Other levers: a smaller architecture (MobileNet, EfficientNet-Lite), lower input resolution, pruning (removing weights that barely
            matter), and distillation (training a small model to imitate a big one).
          </p>
        </>
      ),
      quiz: [
        {
          kind: "task",
          q: "Use 4 bits or fewer and keep the error on ordinary weights below 15%.",
          Sim: QuantSim,
          check: (s) => s.bits <= 4 && s.err < 0.15,
          done: "Calibration did it: a few huge weights were stretching the range so far that ordinary weights all rounded to zero.",
        },
        {
          kind: "number",
          q: "A model has 25 million weights stored as 32-bit floats. How many megabytes does it take after INT8 quantisation?",
          answer: 25,
          tolerance: 0.5,
          unit: "MB",
          why: "8 bits is one byte per weight: 25 million bytes, about 25 MB, down from 100 MB.",
        },
        {
          kind: "choice",
          q: "A Grad-CAM heat map for 'ship' lights up the water, not the ship. What should you suspect?",
          options: [
            { t: "The model learned a shortcut: in the training data, ships come with water, so it uses water as evidence.", ok: true, why: "Right. Test it on ships out of water, and collect more varied data." },
            { t: "Grad-CAM is broken.", why: "Possible, but the far likelier story is a real shortcut." },
            { t: "The model is very accurate.", why: "Accuracy on test data with the same shortcut can hide the problem." },
            { t: "The image resolution is too low.", why: "Resolution affects detail, not which region the evidence comes from." },
          ],
        },
      ],
      explain: {
        q: "Why check a heat map before trusting a vision model with high test accuracy?",
        options: [
          {
            t: "High accuracy can come from shortcuts that happen to hold in the test set, like snow for wolves. The heat map shows whether the model looks at the object or at something that merely comes with it.",
            verdict: "right",
            why: "It names the risk and how the heat map reveals it.",
          },
          {
            t: "Heat maps make the model more accurate.",
            verdict: "wrong",
            why: "They explain a model; they don't change it.",
          },
          {
            t: "To find which pixels are most important.",
            verdict: "partly",
            why: "That's what it shows, but the reason to look is to catch the model relying on the wrong ones.",
          },
          {
            t: "Regulations require it for every model.",
            verdict: "wrong",
            why: "Some settings require explanations, but that's not why it's good practice everywhere.",
          },
        ],
      },
      readMore: [
        { title: "Grad-CAM", by: "Selvaraju et al. (paper)", url: "https://arxiv.org/abs/1610.02391" },
        { title: "pytorch-grad-cam", by: "a library for CAM methods", url: "https://github.com/jacobgil/pytorch-grad-cam" },
        { title: "ONNX Runtime, getting started with Python", by: "documentation", url: "https://onnxruntime.ai/docs/get-started/with-python.html" },
        { title: "Quantization", by: "PyTorch documentation", url: "https://pytorch.org/docs/stable/quantization.html" },
      ],
    },
  ],
};
