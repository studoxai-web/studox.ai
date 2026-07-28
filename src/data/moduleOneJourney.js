const moduleOneJourney = {
  slug: "web-and-internet-architecture",
  moduleNumber: 1,
  title: "Module 1: Web and Internet Architecture",
  description: "Understand how modern websites and web applications are built from frontend to backend.",
  topics: [
    {
      slug: "what-is-web-development",
      title: "What is Web Development?",
      shortTitle: "Web Development",
      segments: [
        "Web development is the process of creating and maintaining websites or web applications.",
        "It includes designing webpage structure, adding functionality, and managing data.",
        "Developers use technologies such as HTML, CSS, JavaScript, servers, and databases.",
        "A web developer may work on the frontend, backend, or both.",
        "Examples include e-commerce websites, social media platforms, and online dashboards.",
      ],
      lesson: {
        title: "How the Web Becomes a Working Product",
        intro: "Web development turns an idea into an experience that people can open in a browser. It combines the visible interface, the logic behind it, and the data that keeps the product useful.",
        definition: "A web developer creates and maintains websites or web applications. The work can include structuring pages, styling interfaces, adding interactions, connecting servers, and storing or retrieving data.",
        example: "Think about an online store. Its product pages and cart interface appear in the browser, its server calculates orders and payments, and its database remembers products, customers, and purchases.",
        takeaway: "Web development is not only page design. It is the complete process of making a browser-based product look right, behave correctly, and work reliably.",
        visualType: "flow",
        flow: ["Idea and user need", "Browser interface", "Application logic", "Stored data", "Working web product"],
        comparison: [],
        keyPoints: ["Runs through a web browser", "Combines interface, logic, and data", "Can produce websites or interactive applications"],
      },
      check: {
        question: "Which description best explains web development?",
        options: [
          "Only designing website colors and fonts",
          "Creating and maintaining websites or web applications",
          "Only storing information in databases",
        ],
        answerIndex: 1,
        explanation: "Web development covers the complete process of building and maintaining websites or web applications, including structure, functionality, servers, and data.",
      },
    },
    {
      slug: "frontend-development",
      title: "What is Frontend Development?",
      shortTitle: "Frontend Development",
      segments: [
        "Frontend development is the part of web development that users directly see and interact with.",
        "It includes visible things like search bars, video players, buttons, comments, sidebars, and navigation.",
        "This topic focuses only on identifying the frontend, not building it yet.",
        "YouTube is the running example: everything you see or click is part of its frontend.",
      ],
      lesson: {
        title: "Frontend Development",
        intro: "Frontend is everything users can see and interact with.",
        definition: "Frontend development is the visible, touchable part of a website or web application.",
        example: "On YouTube, the search bar, video player, Like button, comments, sidebar, and navigation are all frontend elements.",
        takeaway: "Frontend = everything users see and interact with.",
        visualType: "concept",
        flow: ["Search bar", "Video player", "Like button", "Comment box", "Sidebar"],
        comparison: [],
        keyPoints: ["Frontend is visible", "Frontend is interactive", "YouTube's screen elements are frontend"],
        flashCards: [
          {
            type: "aiIntro",
            eyebrow: "AI Mentor",
            title: "You know what web development is. Now let's zoom in.",
            goal: "When you open YouTube, what exactly are you looking at?",
            question: "Before naming tools or code, let's identify the part users actually see.",
            estimatedTime: "25 min",
            button: "Let's Find Out"
          },
          {
            type: "concept",
            title: "Frontend is the part users experience directly.",
            content: "Imagine opening YouTube.\n\nThe search bar. The video player. The Like button. The comments. The thumbnails.\n\nEverything you can actually see or click belongs to the frontend.\n\nFrontend is simply the part of a website or web app that users interact with.",
            highlight: "Takeaway: Frontend = everything users see and interact with.",
            button: "Next"
          },
          {
            type: "example",
            title: "Real World Example: YouTube",
            content: "Stay on YouTube for a second. The search box helps you type. The video player lets you watch. The Like button reacts to your click. The comments area lets you read and write. The sidebar helps you move around. Every visible element in that experience is frontend.",
            steps: ["Search", "Video Player", "Like Button", "Comments", "Sidebar", "Navigation"],
            button: "Continue"
          },
          {
            type: "interactiveVisual",
            title: "Spot the Frontend",
            content: "In this YouTube-style interface, every highlighted screen element is part of the frontend because the user can see it or interact with it.",
            steps: ["Search", "Video", "Like Button", "Comment Box", "Sidebar"],
            button: "Try the Challenge"
          },
          {
            type: "observation",
            title: "Observation Challenge",
            content: "Tap everything that belongs to the frontend. The safe rule is simple: if the user can see it or interact with it, it belongs here.",
            correct: ["Search Bar", "Video Player", "Like Button", "Comments", "Sidebar"],
            incorrect: ["Internet", "Database", "Server"],
            highlight: "Search bar, video player, Like button, comments, and sidebar are frontend. Internet, database, and server are not directly visible to the user.",
            button: "Continue"
          },
          {
            type: "quiz",
            title: "Quick Quiz",
            question: "When you click the Like button on YouTube, which part are you directly interacting with?",
            options: ["Frontend", "Backend", "Database"],
            button: "Submit"
          },
          {
            type: "complete",
            title: "You can now identify the frontend.",
            content: "Feature Unlocked: You can look at any website or web application and point out the part users directly see and interact with.\n\nInteresting... now you know everything you can actually see. But when you press Play, where does the video actually come from? Who remembers your account? Who stores your comments? That invisible world is called...",
            next: "Backend Development",
            button: "Explore Backend"
          }
        ],
      },
      check: {
        question: "When you click the Like button on YouTube, which part are you directly interacting with?",
        options: ["Frontend", "Backend", "Database"],
        answerIndex: 0,
        explanation: "The Like button is visible and clickable, so the user directly interacts with the frontend.",
      },
    },
    {
      slug: "backend-development",
      title: "What is Backend Development?",
      shortTitle: "Backend Development",
      segments: [
        "Backend development is the hidden work that makes a website or web application function.",
        "It receives requests, processes what needs to happen, remembers information, and sends useful data back.",
        "This topic focuses only on understanding what the backend does, not the tools used to build it.",
        "YouTube is the running example: playing videos, remembering playlists, and saving comments need backend work.",
      ],
      lesson: {
        title: "Backend Development",
        intro: "Backend is the hidden part of a website or web application that does the work behind the scenes.",
        definition: "Backend development handles requests, processes what should happen, remembers information, and sends useful data back to the frontend.",
        example: "On YouTube, pressing Play, finding a video, remembering your playlists, and saving comments all depend on backend work.",
        takeaway: "Backend = everything working behind the scenes.",
        visualType: "flow",
        flow: ["User clicks Play", "Frontend sends request", "Backend receives request", "Backend finds video", "Backend sends response", "Frontend displays video"],
        comparison: [],
        keyPoints: ["Backend is hidden", "Backend processes requests", "Backend helps products remember information"],
        flashCards: [
          {
            type: "aiIntro",
            eyebrow: "AI Mentor",
            title: "You found the frontend. Now let's look behind it.",
            goal: "You discovered that everything you can see belongs to the frontend. But when you press Play on YouTube, where does the video actually come from?",
            question: "Who is doing the hidden work after the click?",
            estimatedTime: "25 min",
            button: "Let's Explore"
          },
          {
            type: "concept",
            title: "Backend is the hidden worker behind the screen.",
            content: "Imagine pressing Play on YouTube.\n\nThe button you clicked belongs to the frontend.\n\nBut that click alone cannot play a video.\n\nSomething behind the scenes receives your request, finds the correct video, checks that it can be shown, and sends it back.\n\nThat hidden worker is called the backend.",
            highlight: "Takeaway: Backend = everything working behind the scenes.",
            button: "Next"
          },
          {
            type: "example",
            title: "Real World Example: YouTube",
            content: "You press Play. Behind the scenes, YouTube receives the request, finds the video, sends it back, and the frontend displays it. The same hidden world helps with logging in, searching videos, posting comments, and saving playlists.",
            steps: ["Press Play", "Backend receives request", "Backend finds video", "Backend sends video back", "Frontend displays video"],
            button: "Continue"
          },
          {
            type: "interactiveVisual",
            title: "Follow the Hidden Work",
            content: "Notice where the real work happens. The frontend starts the action, but the backend handles the hidden processing and sends the result back.",
            badgeLabel: "Backend work",
            steps: ["User clicks Play", "Frontend sends request", "Backend receives request", "Backend finds video", "Backend sends response", "Frontend displays video"],
            button: "Try the Challenge"
          },
          {
            type: "observation",
            title: "Observation Challenge",
            content: "Which of these actions are handled by the backend?",
            correct: ["Logging into your account", "Remembering your playlists", "Finding a requested video", "Saving comments"],
            incorrect: ["Play Button", "Search Box", "Like Button appearance"],
            highlight: "Backend work is the hidden processing and remembering. Visible buttons and boxes belong to the frontend.",
            button: "Continue"
          },
          {
            type: "quiz",
            title: "Quick Quiz",
            question: "When YouTube remembers your watch history, which part is responsible?",
            options: ["Frontend", "Backend", "Monitor"],
            button: "Submit"
          },
          {
            type: "complete",
            title: "You can now identify backend work.",
            content: "Feature Unlocked: You can now identify what the backend does inside a web application.\n\nSo now you understand something important: frontend handles everything users can see. Backend handles everything behind the scenes.\n\nBut does every developer specialize in only one? Or can someone build both?",
            next: "Full Stack Development",
            button: "Explore Full Stack"
          }
        ],
      },
      check: {
        question: "When YouTube remembers your watch history, which part is responsible?",
        options: ["Frontend", "Backend", "Monitor"],
        answerIndex: 0,
        explanation: "Remembering watch history is hidden product work, so it belongs to the backend.",
      },
    },
    {
      slug: "full-stack-development",
      title: "What is Full-Stack Development?",
      shortTitle: "Full Stack Development",
      segments: [
        "Full-stack development includes both frontend and backend development.",
        "A full-stack developer understands and can work on both sides of a web application.",
        "This does not mean knowing every technology or being an expert in everything.",
        "This topic focuses only on the role: one person who can connect what users see with what works behind the scenes.",
      ],
      lesson: {
        title: "Full Stack Development",
        intro: "Full stack means understanding and working across both the frontend and the backend.",
        definition: "A full stack developer can work on the visible user-facing side and the hidden behind-the-scenes side of a web application.",
        example: "On YouTube, the video player is frontend work. The hidden system that stores comments is backend work. A full stack developer understands both sides.",
        takeaway: "Full Stack = Frontend + Backend.",
        visualType: "concept",
        flow: ["Frontend", "Full Stack", "Backend"],
        comparison: [],
        keyPoints: ["Understands frontend", "Understands backend", "Can connect both sides"],
        flashCards: [
          {
            type: "aiIntro",
            eyebrow: "AI Mentor",
            title: "You now know the two sides.",
            goal: "Frontend is what users see. Backend is what works behind the scenes.",
            question: "But do companies always need two different developers?",
            estimatedTime: "30 min",
            button: "Let's Find Out"
          },
          {
            type: "concept",
            title: "Full Stack means working across both sides.",
            content: "Imagine building YouTube.\n\nOne developer designs the video player.\n\nAnother builds the hidden system that delivers videos.\n\nSometimes, one developer understands and can work on both.\n\nThat developer is called a Full Stack Developer.",
            highlight: "Takeaway: Full Stack = Frontend + Backend.",
            button: "Next"
          },
          {
            type: "example",
            title: "Real World Example: YouTube",
            content: "Designing the video player is frontend work. Making comments save properly is backend work. Understanding and working on both sides is full stack work.",
            steps: ["Design video player -> Frontend", "Store comments -> Backend", "Work on both -> Full Stack"],
            button: "Continue"
          },
          {
            type: "interactiveVisual",
            title: "Both Sides, One Bridge",
            content: "Full stack sits in the middle because it connects what users see with what happens behind the scenes.",
            badgeLabel: "Full Stack",
            steps: ["Frontend", "Full Stack", "Backend", "Visible experience", "Hidden work", "Connected product"],
            button: "Try the Match"
          },
          {
            type: "observation",
            title: "Matching Challenge",
            content: "Who would most likely work on these tasks?",
            correct: ["Creating a search button -> Frontend", "Making login work -> Backend", "Working on both features -> Full Stack"],
            incorrect: ["Full Stack means every technology", "Frontend means hidden work", "Backend means button design"],
            highlight: "Frontend handles what users see. Backend handles hidden work. Full stack means understanding and working across both.",
            button: "Continue"
          },
          {
            type: "quiz",
            title: "Quick Quiz",
            question: "A developer designs the website interface and also builds the system that stores user comments. What type of developer is this?",
            options: ["Frontend Developer", "Backend Developer", "Full Stack Developer"],
            button: "Submit"
          },
          {
            type: "complete",
            title: "You now understand Full Stack Development.",
            content: "Feature Unlocked: You now understand what a Full Stack Developer does.\n\nSo now we know who builds websites. But here's something people often confuse...\n\nIs YouTube just a website? Or is it something more?",
            next: "Website vs Web Application",
            button: "Explore Next Topic"
          }
        ],
      },
      check: {
        question: "A developer designs the website interface and also builds the system that stores user comments. What type of developer is this?",
        options: [
          "Frontend Developer",
          "Backend Developer",
          "Full Stack Developer",
        ],
        answerIndex: 2,
        explanation: "A Full Stack Developer understands and can work on both the frontend and the backend.",
      },
    },
    {
      slug: "website-vs-web-application",
      title: "Website vs Web Application",
      shortTitle: "Website vs Web Application",
      segments: [
        "A website mainly presents information for users to read or view.",
        "A web application lets users interact, perform actions, save things, edit things, upload, or personalize their experience.",
        "Products like YouTube, Gmail, Instagram, and ChatGPT are accessed through a website but behave more like web applications.",
        "This topic focuses on how users experience the product, not how it is implemented.",
      ],
      lesson: {
        title: "Website vs Web Application",
        intro: "A website mainly presents information. A web application lets users interact and perform meaningful actions.",
        definition: "A website is mostly for reading, browsing, or viewing information. A web application is for doing things: logging in, creating, editing, uploading, saving, commenting, or personalizing content.",
        example: "A portfolio is usually a website because you mainly read and view it. YouTube is better described as a web application because users watch, like, comment, upload, save playlists, and personalize their experience.",
        takeaway: "Website = mostly consume information. Web Application = interact and perform tasks.",
        visualType: "comparison",
        flow: [],
        comparison: [
          { label: "Primary use", left: "Read or view", right: "Interact and do tasks" },
          { label: "User action", left: "Browse information", right: "Create, edit, save, upload" },
          { label: "Example", left: "Portfolio or menu", right: "YouTube or Gmail" },
        ],
        keyPoints: ["Websites are usually content-first", "Web applications are interaction-first", "Modern products can combine both"],
        flashCards: [
          {
            type: "aiIntro",
            eyebrow: "AI Mentor",
            title: "We know who builds websites. But what are they building?",
            goal: "Is YouTube just a website? Most people say yes, but developers often call it a web application.",
            question: "Why would they use a different name?",
            estimatedTime: "20 min",
            button: "Let's Find Out"
          },
          {
            type: "concept",
            title: "Start with what the user does.",
            content: "Open a personal portfolio.\n\nYou mainly read information, view projects, and browse pages.\n\nNow open YouTube.\n\nYou log in, watch videos, upload, comment, like, save playlists, and personalize what you see.\n\nNotice the difference?",
            highlight: "Website -> mostly consume information. Web Application -> interact and perform tasks.",
            button: "Next"
          },
          {
            type: "example",
            title: "Real World Comparison",
            content: "Wikipedia, a personal portfolio, and a restaurant menu are mostly websites because the main experience is reading or viewing information. YouTube, Instagram, Gmail, and ChatGPT are web applications because users actively do things inside them.",
            steps: ["Wikipedia -> Mostly Website", "Portfolio -> Website", "Restaurant Menu -> Website", "YouTube -> Web Application", "Instagram -> Web Application", "Gmail -> Web Application", "ChatGPT -> Web Application"],
            button: "Continue"
          },
          {
            type: "interactiveVisual",
            title: "Information vs Interaction",
            content: "A website leans toward reading and browsing. A web application leans toward actions like login, comment, upload, save, edit, and personalize.",
            badgeLabel: "User action",
            steps: ["Website: Read", "Website: Browse", "Website: View information", "Web App: Log in", "Web App: Comment", "Web App: Upload", "Web App: Save", "Web App: Edit"],
            button: "Sort Products"
          },
          {
            type: "observation",
            title: "Sorting Challenge",
            content: "Sort each product into the category that best describes its primary use.",
            correct: ["Wikipedia -> Website", "Portfolio -> Website", "YouTube -> Web Application", "Instagram -> Web Application", "Gmail -> Web Application", "ChatGPT -> Web Application"],
            incorrect: ["Gmail -> Mostly Website", "Portfolio -> Web Application", "YouTube -> Static information page"],
            highlight: "Look at the main experience. If users mainly read, it leans website. If users actively do tasks, it leans web application.",
            button: "Continue"
          },
          {
            type: "quiz",
            title: "Quick Quiz",
            question: "A website lets users log in, edit their profile, upload files, and save information. What is it best described as?",
            options: ["Website", "Web Application", "Search Engine"],
            button: "Submit"
          },
          {
            type: "complete",
            title: "You can now tell the difference.",
            content: "Feature Unlocked: You can now distinguish between a website and a web application.\n\nNow you know that some websites are interactive while others simply display information.\n\nBut here's another question: why does Wikipedia usually look the same every time you visit, while your YouTube homepage changes every single day?",
            next: "Static vs Dynamic Websites",
            button: "Explore Next Topic"
          }
        ],
      },
      check: {
        question: "A website lets users log in, edit their profile, upload files, and save information. What is it best described as?",
        options: ["Website", "Web Application", "Search Engine"],
        answerIndex: 1,
        explanation: "Because users actively log in, edit, upload, and save things, it is best described as a web application.",
      },
    },
    {
      slug: "static-vs-dynamic-websites",
      title: "Static vs Dynamic Websites",
      shortTitle: "Static vs Dynamic",
      segments: [
        "Static websites show essentially the same content to most visitors.",
        "Dynamic websites can change based on users, time, stored information, or interactions.",
        "A portfolio or restaurant menu usually behaves statically.",
        "A YouTube homepage or inbox usually behaves dynamically.",
      ],
      lesson: {
        title: "Static vs Dynamic Websites",
        intro: "Static and dynamic describe how a website behaves for visitors.",
        definition: "A static website usually shows the same content to most visitors. A dynamic website can change what it shows based on the user, time, saved information, or interactions.",
        example: "A photographer's portfolio may show the same photos to everyone. Your YouTube homepage can look different from your friend's homepage because the experience changes for each user.",
        takeaway: "Static = same experience for most visitors. Dynamic = experience can change.",
        visualType: "comparison",
        flow: [],
        comparison: [
          { label: "Visitor A", left: "Same page", right: "Personalized page" },
          { label: "Visitor B", left: "Same page", right: "Different personalized page" },
          { label: "Example", left: "Portfolio", right: "YouTube home" },
        ],
        keyPoints: ["Static is simpler", "Dynamic responds to data", "Most real apps are dynamic"],
        flashCards: [
          {
            type: "aiIntro",
            eyebrow: "AI Mentor",
            title: "Some pages stay the same. Some keep changing.",
            goal: "You discovered that some websites are actually web applications. Now here's something curious: Wikipedia usually looks almost the same every time, while your YouTube homepage is different every day.",
            question: "Why does that happen?",
            estimatedTime: "20 min",
            button: "Let's Discover"
          },
          {
            type: "concept",
            title: "Watch how the experience behaves.",
            content: "Imagine two websites.\n\nWebsite A is a photographer's portfolio. Every visitor sees the same photos and information.\n\nWebsite B is your YouTube homepage. You and your friend see different recommendations.\n\nThat difference is the idea behind static and dynamic.",
            highlight: "Static = same experience for most visitors. Dynamic = experience can change.",
            button: "Next"
          },
          {
            type: "example",
            title: "Real World Examples",
            content: "A portfolio, restaurant menu, company landing page, and many Wikipedia articles usually behave more statically for readers. YouTube Home, Instagram Feed, Gmail Inbox, and ChatGPT conversations behave dynamically because the experience changes for the user.",
            steps: ["Portfolio Website -> Static", "Restaurant Menu -> Static", "Company Landing Page -> Static", "Wikipedia Article -> Mostly Static", "YouTube Home -> Dynamic", "Instagram Feed -> Dynamic", "Gmail Inbox -> Dynamic", "ChatGPT Conversation -> Dynamic"],
            button: "Continue"
          },
          {
            type: "interactiveVisual",
            title: "Same Page vs Personalized Page",
            content: "On the static side, Visitor A and Visitor B see the same page. On the dynamic side, Visitor A and Visitor B can see different personalized pages.",
            badgeLabel: "Page behavior",
            steps: ["Static: Visitor A -> Same Page", "Static: Visitor B -> Same Page", "Dynamic: Visitor A -> Personalized Page", "Dynamic: Visitor B -> Different Personalized Page"],
            button: "Predict Examples"
          },
          {
            type: "observation",
            title: "Prediction Challenge",
            content: "Predict whether each example is static or dynamic.",
            correct: ["Personal Portfolio -> Static", "Restaurant Menu -> Static", "Wikipedia Article -> Mostly Static", "YouTube Home -> Dynamic", "Instagram Feed -> Dynamic", "Online Banking Dashboard -> Dynamic"],
            incorrect: ["YouTube Home -> Static", "Portfolio -> Dynamic by default", "Banking Dashboard -> Same for everyone"],
            highlight: "Static usually means the content stays the same. Dynamic means the content can change based on the user or situation.",
            button: "Continue"
          },
          {
            type: "quiz",
            title: "Quick Quiz",
            question: "A website shows your personal messages after you log in. What type of website is it most likely?",
            options: ["Static Website", "Dynamic Website", "Search Engine"],
            button: "Submit"
          },
          {
            type: "complete",
            title: "You can now identify static and dynamic behavior.",
            content: "Feature Unlocked: You can now identify whether a website behaves statically or dynamically.\n\nNow you know why websites can behave differently.\n\nBut here's the real mystery: if YouTube creates a personalized homepage just for you, how does your computer actually communicate with YouTube's computer to make that happen?",
            next: "Client & Server",
            button: "Explore Next Topic"
          }
        ],
      },
      check: {
        question: "A website shows your personal messages after you log in. What type of website is it most likely?",
        options: ["Static Website", "Dynamic Website", "Search Engine"],
        answerIndex: 1,
        explanation: "A page that shows personal messages changes based on the user, so it behaves dynamically.",
      },
    },
    {
      slug: "client-and-server-introduction",
      title: "Client & Server",
      shortTitle: "Client & Server",
      segments: [
        "Your computer or phone is the client.",
        "The website's computer is the server.",
        "The client asks for something.",
        "The server responds with what the client needs.",
      ],
      lesson: {
        title: "Client & Server",
        intro: "Your computer does not open most websites all by itself. It asks another computer for what it needs.",
        definition: "Your laptop or phone is called the client because it requests information. The computer that owns and provides the website is called the server because it responds.",
        example: "When you open YouTube, your computer asks for YouTube. Another computer sends back what is needed, and then the page appears.",
        takeaway: "Client asks. Server answers.",
        visualType: "flow",
        flow: ["Laptop asks", "Can I have YouTube?", "Server answers", "Sending homepage", "Laptop displays page"],
        comparison: [],
        keyPoints: ["Your device is the client", "The website's computer is the server", "Client asks and server responds"],
        flashCards: [
          {
            type: "aiIntro",
            eyebrow: "AI Mentor",
            title: "Your computer is about to talk to another computer.",
            goal: "We now know websites can be dynamic. But if YouTube is not stored on your computer, where does it actually come from?",
            question: "When you press Enter, who are you talking to?",
            estimatedTime: "20 min",
            button: "Let's Discover"
          },
          {
            type: "concept",
            title: "First, imagine the conversation.",
            content: "Imagine opening YouTube.\n\nYou type youtube.com and press Enter.\n\nNothing exists on your laptop yet.\n\nYour computer politely asks another computer: Can you send me YouTube?\n\nThat other computer replies: Of course.\n\nSeconds later, the page appears.",
            highlight: "This simple ask-and-answer conversation happens almost every time you open a website.",
            button: "Now Name the Parts"
          },
          {
            type: "concept",
            title: "Now we can name the two sides.",
            content: "Your laptop or phone is called the client because it requests information.\n\nThe computer that owns and provides the website is called the server.\n\nEvery website depends on this simple relationship.",
            highlight: "Takeaway: Client asks. Server answers.",
            button: "Show Me"
          },
          {
            type: "interactiveVisual",
            title: "The Basic Architecture",
            content: "The client asks for YouTube. The server sends back what the client needs. Then the client displays the page.",
            badgeLabel: "Ask -> Answer",
            steps: ["Laptop", "Can I have YouTube?", "Server", "Sending homepage...", "Laptop displays page"],
            button: "Run Mini Simulation"
          },
          {
            type: "observation",
            title: "Mini Simulation",
            content: "Press Open YouTube in your mind. The client sends a request, the server replies, and the page appears. Who requested the page?",
            correct: ["Client"],
            incorrect: ["Server", "Browser"],
            highlight: "The client requested the page. The server replied with what the client needed.",
            button: "Continue"
          },
          {
            type: "quiz",
            title: "Quick Quiz",
            question: "Who sends the request when you open YouTube?",
            options: ["Client", "Server", "Database"],
            button: "Submit"
          },
          {
            type: "complete",
            title: "You now understand the basic conversation.",
            content: "Feature Unlocked: You now understand how computers communicate with websites.\n\nGreat. Now your computer knows it needs to ask a server.\n\nBut there are millions of servers on the Internet. How does your computer know which one belongs to YouTube?",
            next: "How Browsers Work",
            button: "Explore Next Topic"
          }
        ],
      },
      check: {
        question: "Who sends the request when you open YouTube?",
        options: ["Client", "Server", "Database"],
        answerIndex: 0,
        explanation: "Your computer or phone is the client, so it sends the request.",
      },
    },
    {
      slug: "how-a-browser-works",
      title: "How Your Browser Finds a Website",
      shortTitle: "Browser, Domain, DNS & Hosting",
      segments: [
        "The browser starts the journey when you type a website name.",
        "A domain name is the human-friendly address, such as youtube.com.",
        "DNS helps locate where that website lives.",
        "Hosting is the computer where the website is available.",
      ],
      lesson: {
        title: "How Your Browser Finds a Website",
        intro: "Typing youtube.com starts a small journey before anything appears on screen.",
        definition: "The browser starts the journey, the domain gives a readable name, DNS helps locate the right place, hosting is where the website lives, and then the browser receives the website.",
        example: "When you type youtube.com, your browser uses that name to find where YouTube lives, reaches the hosted website, and receives what it needs.",
        takeaway: "Browser -> Domain -> DNS -> Hosting -> Website returned.",
        visualType: "flow",
        flow: ["Browser", "youtube.com", "DNS finds location", "Hosting computer", "Website returned"],
        comparison: [],
        keyPoints: ["Browser starts the journey", "Domain is a readable address", "DNS helps find the right location", "Hosting is where the website lives"],
        flashCards: [
          {
            type: "aiIntro",
            eyebrow: "AI Mentor",
            title: "Your computer knows it needs to ask a server.",
            goal: "But there are millions of servers on the Internet. How does your computer know which one belongs to YouTube?",
            question: "Let's follow what happens after you type youtube.com.",
            estimatedTime: "25 min",
            button: "Let's Follow The Journey"
          },
          {
            type: "concept",
            title: "The story begins with youtube.com.",
            content: "Imagine writing youtube.com inside your browser.\n\nYou press Enter.\n\nWithin moments, many things happen before the homepage appears.\n\nToday we're following that exact journey from name to website.",
            highlight: "The browser starts a journey before the page appears.",
            button: "Meet the Browser"
          },
          {
            type: "concept",
            title: "Meet the Browser",
            content: "The browser is your gateway to the web.\n\nIt begins the journey when you type a website name and press Enter.\n\nChrome, Edge, Safari, and Firefox are all browsers.",
            highlight: "Browser = the app that starts the web journey.",
            button: "Meet the Domain"
          },
          {
            type: "concept",
            title: "Meet the Domain Name",
            content: "youtube.com is a domain name.\n\nA domain name is an easy-to-remember address for a website.\n\nThink of your phone contacts: you tap a contact name instead of memorizing the full phone number.\n\nA domain works like that for websites.",
            highlight: "Domain = human-friendly website address.",
            button: "Meet DNS"
          },
          {
            type: "concept",
            title: "Meet DNS",
            content: "DNS works like your phone contacts.\n\nYou tap Mom instead of remembering the phone number.\n\nSimilarly, DNS helps find where youtube.com actually lives.",
            highlight: "DNS helps locate the right website destination.",
            button: "Meet Hosting"
          },
          {
            type: "concept",
            title: "Meet Hosting",
            content: "Once the correct location is found, your browser reaches the computer where YouTube is available.\n\nThat place is called hosting.\n\nHosting simply means the website lives on a computer connected to the Internet.",
            highlight: "Hosting = where the website lives online.",
            button: "Watch the Journey"
          },
          {
            type: "interactiveVisual",
            title: "The Complete Journey",
            content: "Watch the whole path: browser starts, domain gives the readable name, DNS finds the location, hosting provides the website, and the website returns.",
            badgeLabel: "Journey step",
            steps: ["Browser", "youtube.com", "DNS finds location", "Hosting computer", "Website returned"],
            button: "Quick Quiz"
          },
          {
            type: "quiz",
            title: "Quick Quiz",
            question: "What helps your browser locate where youtube.com is?",
            options: ["Hosting", "DNS", "Frontend"],
            button: "Submit"
          },
          {
            type: "complete",
            title: "You now understand how your browser finds a website.",
            content: "Feature Unlocked: You now understand how your browser finds a website.\n\nSo now your browser found YouTube.\n\nBut how does it actually ask the server for the homepage, and how does the server send it back?",
            next: "Request -> Response Cycle",
            button: "Continue The Journey"
          }
        ],
      },
      check: {
        question: "What helps your browser locate where youtube.com is?",
        options: ["Hosting", "DNS", "Frontend"],
        answerIndex: 1,
        explanation: "DNS helps the browser find where a domain name like youtube.com points.",
      },
    },
    {
      slug: "request-response-cycle",
      title: "Request -> Response Cycle",
      shortTitle: "Request -> Response Cycle",
      segments: [
        "A request is the client asking the server for something.",
        "The server receives the request and prepares what is needed.",
        "A response is the server's answer.",
        "The browser displays the result on screen.",
      ],
      lesson: {
        title: "Request -> Response Cycle",
        intro: "After the browser finds the correct server, the page appears through a simple conversation: request, prepare, response, display.",
        definition: "A request is what the client sends when it asks for something. A response is what the server sends back after preparing the answer.",
        example: "When you search for Cats on YouTube, the browser sends a request. The server prepares matching results and sends a response. The browser then displays the results.",
        takeaway: "Request = asking. Response = the server's answer.",
        visualType: "flow",
        flow: ["Browser", "Request", "Server", "Response", "Browser", "Page appears"],
        comparison: [],
        keyPoints: ["Client sends a request", "Server prepares an answer", "Browser displays the response"],
        flashCards: [
          {
            type: "aiIntro",
            eyebrow: "AI Mentor",
            title: "Finding YouTube was only step one.",
            goal: "Great! Your browser now knows exactly where YouTube lives. But finding the house is not enough.",
            question: "How do you actually ask for the homepage?",
            estimatedTime: "20 min",
            button: "Continue"
          },
          {
            type: "concept",
            title: "Think of a restaurant first.",
            content: "Imagine visiting a restaurant.\n\nYou ask the waiter for a pizza.\n\nThe waiter goes to the kitchen.\n\nThe kitchen prepares it, and the waiter brings it back.\n\nEvery website works in a surprisingly similar way.",
            highlight: "A website works through a simple ask, prepare, bring-back flow.",
            button: "Name the First Message"
          },
          {
            type: "concept",
            title: "The first message is a Request.",
            content: "When you click a button or enter a website, your browser asks the server for something.\n\nThat message is called a request.\n\nOpening a homepage, playing a video, searching, logging in, and liking a video all begin with a request.",
            highlight: "Request = asking for something.",
            button: "What Comes Back?"
          },
          {
            type: "concept",
            title: "The server answers with a Response.",
            content: "The server receives the request.\n\nIt prepares the information.\n\nThen it sends the answer back.\n\nThat reply is called a response.\n\nA homepage, video, search results, comments, or profile can all come back as responses.",
            highlight: "Response = the server's answer.",
            button: "Show the Journey"
          },
          {
            type: "interactiveVisual",
            title: "The Journey Animation",
            content: "The browser asks, the server prepares, the server answers, and the browser displays the result.",
            badgeLabel: "Cycle step",
            steps: ["Browser", "Request", "Server", "Response", "Browser", "Page appears"],
            button: "Try Mini Simulation"
          },
          {
            type: "observation",
            title: "Mini Simulation",
            content: "You press Watch Video. The first thing that travels away from your browser starts the conversation. What traveled from your browser first?",
            correct: ["Request"],
            incorrect: ["Response", "Database"],
            highlight: "The request traveled first. The response comes back after the server prepares the answer.",
            button: "Continue"
          },
          {
            type: "quiz",
            title: "Quick Quiz",
            question: "When you search for \"Cats\", what does your browser send first?",
            options: ["Request", "Response", "Database"],
            button: "Submit"
          },
          {
            type: "complete",
            title: "You now understand request and response.",
            content: "Feature Unlocked: You now understand how every webpage reaches your screen.\n\nSo now you understand the conversation.\n\nBut how do the browser and server know how to communicate? What rules do they follow? That language is called...",
            next: "HTTP & HTTPS",
            button: "Learn the Language"
          }
        ],
      },
      check: {
        question: "When you search for \"Cats\", what does your browser send first?",
        options: ["Request", "Response", "Database"],
        answerIndex: 0,
        explanation: "The browser sends a request first. The response comes back after the server prepares an answer.",
      },
    },
    {
      slug: "introduction-to-dns",
      title: "HTTP vs HTTPS",
      shortTitle: "HTTP vs HTTPS",
      segments: [
        "HTTP is the communication rule system browsers and servers follow.",
        "HTTPS is the safer version of HTTP.",
        "HTTPS helps protect information while it travels across the internet.",
        "This topic focuses on purpose, not internal networking details.",
      ],
      lesson: {
        title: "HTTP & HTTPS",
        intro: "Browsers and servers need shared rules so their request-response conversation makes sense.",
        definition: "HTTP is the communication rule system browsers and servers follow. HTTPS follows the same idea but adds protection for information while it travels.",
        example: "When YouTube loads a page, the browser and server communicate using these web rules. When account information is involved, HTTPS is expected because the conversation should be safer.",
        takeaway: "HTTP is the conversation rulebook. HTTPS is the safer version.",
        visualType: "comparison",
        flow: ["Browser", "HTTP message", "Server", "Browser", "HTTPS protected message", "Server"],
        comparison: [],
        keyPoints: ["HTTP gives browsers and servers shared rules", "HTTPS adds protection", "Sensitive information should use HTTPS"],
        flashCards: [
          {
            type: "aiIntro",
            eyebrow: "AI Mentor",
            title: "Requests and responses need rules.",
            goal: "Now your browser knows how to send a request and receive a response.",
            question: "But how do both computers understand each other? How do they know the rules of the conversation?",
            estimatedTime: "20 min",
            button: "Let's Learn"
          },
          {
            type: "concept",
            title: "Two computers need a shared language.",
            content: "Imagine two people trying to talk while speaking different languages.\n\nWithout common rules, the conversation falls apart.\n\nBrowsers and servers also need common rules so the request-response conversation makes sense.\n\nThat shared web language is called HTTP.",
            highlight: "Browsers and servers need shared rules to understand each other.",
            button: "What is HTTP?"
          },
          {
            type: "concept",
            title: "HTTP is the rulebook for the conversation.",
            content: "HTTP is a set of communication rules that both the browser and server follow.\n\nIt helps the browser ask for something.\n\nIt helps the server understand the request and send back a useful response.\n\nYou do not need the internal details yet. Just remember the purpose.",
            highlight: "HTTP = the rules of the conversation.",
            button: "What is HTTPS?"
          },
          {
            type: "concept",
            title: "HTTPS makes the conversation safer.",
            content: "Imagine sending a postcard.\n\nAnyone along the way could read it.\n\nNow imagine placing the message inside a locked envelope.\n\nThat is the idea behind HTTPS.\n\nHTTPS follows the same communication rules as HTTP but adds protection for your information.",
            highlight: "HTTPS = HTTP with security.",
            button: "Compare Them"
          },
          {
            type: "interactiveVisual",
            title: "HTTP vs HTTPS",
            content: "Compare two browser-server conversations. HTTP sends a normal message. HTTPS sends a protected message.",
            badgeLabel: "Conversation",
            steps: ["HTTP browser", "Visible message", "HTTP server", "HTTPS browser", "Protected message", "HTTPS server"],
            button: "Spot Secure Moments"
          },
          {
            type: "observation",
            title: "Security Spotting Challenge",
            content: "Which examples should absolutely use HTTPS because sensitive information may be involved?",
            correct: ["Online Banking", "Login Page", "Personal Email"],
            incorrect: ["News Website"],
            highlight: "HTTPS is expected whenever sensitive information is involved. A simple public news page can still use HTTPS, but the need is strongest when private data is moving.",
            button: "Quick Quiz"
          },
          {
            type: "quiz",
            title: "Quick Quiz",
            question: "What is the biggest difference between HTTP and HTTPS?",
            options: ["HTTPS adds security", "HTTPS is faster", "HTTP cannot display websites"],
            button: "Submit"
          },
          {
            type: "complete",
            title: "You now understand why secure websites use HTTPS.",
            content: "Feature Unlocked: You now understand why secure websites use HTTPS.\n\nGreat! Your browser and server can now communicate safely.\n\nBut what happens when YouTube needs information from another service instead of doing everything itself? How do different applications talk to each other?",
            next: "APIs & JSON",
            button: "Explore APIs"
          }
        ],
      },
      check: {
        question: "What is the biggest difference between HTTP and HTTPS?",
        options: ["HTTPS adds security", "HTTPS is faster", "HTTP cannot display websites"],
        answerIndex: 0,
        explanation: "HTTPS follows the same web communication idea as HTTP, but adds protection for information while it travels.",
      },
    },
    {
      slug: "api-introduction",
      title: "APIs & JSON",
      shortTitle: "APIs & JSON",
      segments: [
        "APIs help different software systems communicate.",
        "An API acts like a messenger between applications or services.",
        "JSON is a structured way to organize and send information.",
        "APIs and JSON commonly work together.",
      ],
      lesson: {
        title: "APIs & JSON",
        intro: "Applications need a clean way to exchange information with other applications and services.",
        definition: "An API acts like a messenger between software systems. JSON is one common structured format used to carry organized information.",
        example: "YouTube might ask a recommendation service for videos. The API carries the message, and the returned information can be organized as JSON data.",
        takeaway: "APIs are messengers. JSON is organized information.",
        visualType: "flow",
        flow: ["YouTube", "API", "Recommendation Service", "JSON Data", "API", "Recommendations Appear"],
        comparison: [],
        keyPoints: ["APIs help software communicate", "APIs do not store information", "JSON organizes data for sending"],
        flashCards: [
          {
            type: "aiIntro",
            eyebrow: "AI Mentor",
            title: "Software needs messengers too.",
            goal: "Great! Now browsers and servers can communicate.",
            question: "But what if YouTube needs information from another service? How do different systems talk to each other?",
            estimatedTime: "20 min",
            button: "Let's Explore"
          },
          {
            type: "concept",
            title: "Start with the restaurant story.",
            content: "Imagine you're in a restaurant.\n\nYou do not walk into the kitchen and ask the chef directly.\n\nYou tell the waiter.\n\nThe waiter carries your request to the kitchen, then brings the food back.\n\nThat waiter is similar to an API.",
            highlight: "An API sits between two software systems and carries messages.",
            button: "Meet the API"
          },
          {
            type: "concept",
            title: "What is an API?",
            content: "An API acts like a messenger between different software systems.\n\nIt receives a request.\n\nIt passes that request to another system.\n\nThen it returns the response.\n\nWeather apps, payment gateways, maps, and YouTube recommendations can all involve APIs.",
            highlight: "API = a messenger between software systems.",
            button: "Meet JSON"
          },
          {
            type: "concept",
            title: "What is JSON?",
            content: "The messenger needs a way to carry information clearly.\n\nJSON is one common format used for that.\n\nThink of JSON like a neatly organized package with labels.\n\nName -> Jai\nAge -> 20\nCourse -> BCA",
            highlight: "JSON = a structured way to organize and send data.",
            button: "Watch the Flow"
          },
          {
            type: "interactiveVisual",
            title: "How APIs and JSON Work Together",
            content: "YouTube asks for recommendations. The API carries the message to another service. The answer comes back as organized JSON data, and YouTube shows recommendations.",
            badgeLabel: "Message flow",
            steps: ["YouTube", "API", "Recommendation Service", "JSON Data", "API", "Recommendations Appear"],
            button: "Try the Challenge"
          },
          {
            type: "observation",
            title: "Message Flow Challenge",
            content: "Arrange the idea in your mind: the application asks, the API carries the message, another service prepares information, JSON organizes it, and the response returns.",
            correct: ["Application", "API", "Another Service", "JSON Data", "Response"],
            incorrect: ["API stores all data", "JSON is the website design", "Application talks by magic"],
            highlight: "The API carries the request and response. JSON is a common organized shape for the information being carried.",
            button: "Quick Quiz"
          },
          {
            type: "quiz",
            title: "Quick Quiz",
            question: "What is the primary role of an API?",
            options: ["Store data", "Help software communicate", "Create websites"],
            button: "Submit"
          },
          {
            type: "complete",
            title: "You now understand APIs and JSON.",
            content: "Feature Unlocked: You now understand how applications exchange information.\n\nNow websites know how to exchange information.\n\nBut have you noticed that YouTube remembers who you are even after you close the browser? How does it recognize you tomorrow?",
            next: "Cookies, Sessions & JWT",
            button: "Continue"
          }
        ],
      },
      check: {
        question: "What is the primary role of an API?",
        options: ["Store data", "Help software communicate", "Create websites"],
        answerIndex: 1,
        explanation: "An API helps software systems communicate by carrying requests and responses between them.",
      },
    },
    {
      slug: "cookies-introduction",
      title: "Cookies, Sessions & JWT",
      shortTitle: "Cookies, Sessions & JWT",
      segments: [
        "Cookies store small pieces of information in the browser.",
        "Sessions help the server remember users.",
        "JWT is another approach for proving identity.",
        "These ideas explain how websites recognize returning users.",
      ],
      lesson: {
        title: "Cookies, Sessions & JWT",
        intro: "Websites need a way to recognize you again after you log in or return later.",
        definition: "Cookies store small pieces of information in the browser. Sessions help the server remember users. JWT is another way to prove identity.",
        example: "After you log in to YouTube, these ideas help the website recognize you again instead of asking you to log in on every refresh.",
        takeaway: "Websites use memory helpers to recognize returning users.",
        visualType: "flow",
        flow: ["User logs in", "Website recognizes user", "Browser stores information", "User returns tomorrow", "Website recognizes user"],
        comparison: [],
        keyPoints: ["Cookies help websites recognize your browser", "Sessions help servers remember users", "JWT is another way to verify identity"],
        flashCards: [
          {
            type: "aiIntro",
            eyebrow: "AI Mentor",
            title: "Websites can remember you.",
            goal: "You now know how websites communicate.",
            question: "Have you noticed that YouTube remembers your account even after you close your browser? How?",
            estimatedTime: "20 min",
            button: "Let's Find Out"
          },
          {
            type: "concept",
            title: "Think of checking into a hotel.",
            content: "Imagine checking into a hotel.\n\nThe receptionist gives you a room card.\n\nThe next time you return to your room, you do not explain who you are again.\n\nYou simply show the card.\n\nWebsites work in a similar way.",
            highlight: "Websites need a way to recognize you again without starting from zero every time.",
            button: "Meet Cookies"
          },
          {
            type: "concept",
            title: "Cookies help websites recognize your browser.",
            content: "Cookies are small pieces of information stored in your browser.\n\nThey can help websites recognize returning visitors.\n\nA cookie can help remember your language, your theme, or that you recently logged in.",
            highlight: "Cookies help websites recognize your browser.",
            button: "Meet Sessions"
          },
          {
            type: "concept",
            title: "Sessions help the server remember you.",
            content: "Sometimes websites store the important memory on the server instead of keeping everything in your browser.\n\nThat remembered connection is called a session.\n\nA session helps the website continue knowing who you are while you move around.",
            highlight: "Sessions help the server remember who you are.",
            button: "Meet JWT"
          },
          {
            type: "concept",
            title: "JWT is another way to prove identity.",
            content: "Some modern applications use a digital identity card instead of a traditional server session.\n\nThis is called JWT.\n\nIt helps prove who you are without storing everything the same way as sessions.\n\nYou do not need the internal structure yet. For now, remember the purpose.",
            highlight: "JWT is another way to verify identity.",
            button: "Watch the Login Journey"
          },
          {
            type: "interactiveVisual",
            title: "The Login Memory Journey",
            content: "A user logs in, the website recognizes the user, the browser stores helpful information, and when the user returns later, the website can recognize them again.",
            badgeLabel: "Memory step",
            steps: ["User logs in", "Website recognizes user", "Browser stores information", "User returns tomorrow", "Website recognizes user"],
            button: "Quick Quiz"
          },
          {
            type: "quiz",
            title: "Quick Quiz",
            question: "Why doesn't YouTube ask you to log in every single time you refresh the page?",
            options: ["Because it remembers information about your login", "Because the browser never closes", "Because the internet stores your password forever"],
            button: "Submit"
          },
          {
            type: "complete",
            title: "You now understand how websites recognize returning users.",
            content: "Feature Unlocked: You now understand how websites recognize returning users.\n\nNow websites know who you are.\n\nBut can any website communicate with any other website whenever it wants?\n\nSurprisingly, browsers sometimes say no. Let's discover why.",
            next: "CORS",
            button: "Explore Final Topic"
          }
        ],
      },
      check: {
        question: "Why doesn't YouTube ask you to log in every single time you refresh the page?",
        options: ["Because it remembers information about your login", "Because the browser never closes", "Because the internet stores your password forever"],
        answerIndex: 0,
        explanation: "Websites use ideas like cookies, sessions, or tokens to recognize returning logged-in users.",
      },
    },
    {
      slug: "cors-introduction",
      title: "CORS",
      shortTitle: "CORS",
      segments: [
        "Browsers protect users from unsafe cross-website communication.",
        "CORS is a browser security mechanism.",
        "Servers can choose whether to allow another website to access their resources.",
        "CORS exists to help keep users safe.",
      ],
      lesson: {
        title: "CORS",
        intro: "Not every website should be allowed to freely access every other website.",
        definition: "CORS stands for Cross-Origin Resource Sharing. It is a browser security mechanism that checks whether one website has permission to access resources from another website.",
        example: "A trusted weather website may be allowed to request public weather data, but a random unknown website should not freely access your banking information.",
        takeaway: "CORS helps browsers protect users by enforcing permission checks.",
        visualType: "flow",
        flow: ["Website asks", "Browser checks permission", "Server allows or denies", "Browser allows or blocks", "User stays safer"],
        comparison: [],
        keyPoints: ["Browsers protect users", "CORS checks permissions", "Servers choose what to allow"],
        flashCards: [
          {
            type: "aiIntro",
            eyebrow: "AI Mentor",
            title: "One final safety question.",
            goal: "You've learned how browsers find websites, communicate, exchange information, and remember users.",
            question: "But can every website freely access every other website?",
            estimatedTime: "20 min",
            button: "Let's Find Out"
          },
          {
            type: "concept",
            title: "The problem: websites should not get unlimited access.",
            content: "Imagine visiting an unknown website.\n\nWithout security rules, that website could try to access information from your banking website or your email.\n\nShould browsers allow that automatically?\n\nProbably not.",
            highlight: "Browsers need to protect users from unsafe cross-website access.",
            button: "Meet the Guard"
          },
          {
            type: "concept",
            title: "Think of an office security guard.",
            content: "Imagine an office building with a security guard.\n\nAnyone can ask to enter.\n\nBut the guard checks whether they have permission.\n\nIf permission is granted, they may enter.\n\nIf not, they are stopped.\n\nBrowsers behave in a similar way.",
            highlight: "Browsers do not blindly trust requests between different websites.",
            button: "What is CORS?"
          },
          {
            type: "concept",
            title: "CORS is the permission check.",
            content: "CORS stands for Cross-Origin Resource Sharing.\n\nThink of it as a permission system.\n\nThe browser checks whether another website has permission to access certain resources.\n\nIf permission exists, communication is allowed.\n\nIf not, the browser blocks it.",
            highlight: "CORS helps browsers protect users by enforcing permission checks.",
            button: "See It Work"
          },
          {
            type: "interactiveVisual",
            title: "Interactive Security Demo",
            content: "Scenario A: Website A asks Website B, permission is granted, and access is allowed. Scenario B: Website C asks Website B, permission is denied, and the browser blocks the request.",
            badgeLabel: "Security check",
            steps: ["Website A asks", "Permission granted", "Access allowed", "Website C asks", "Permission denied", "Browser blocks request"],
            button: "Decision Challenge"
          },
          {
            type: "observation",
            title: "Decision Challenge",
            content: "Should the browser allow these requests? Think like the security guard.",
            correct: ["Banking site requests its own account data", "Trusted weather site requests public weather data"],
            incorrect: ["Random unknown site requests your banking information"],
            highlight: "The browser should allow safe, permitted requests and block suspicious or unapproved access. CORS is about user safety.",
            button: "Quick Quiz"
          },
          {
            type: "quiz",
            title: "Quick Quiz",
            question: "Why does CORS exist?",
            options: ["To slow down websites", "To protect users by controlling which websites can access resources", "To replace HTTP"],
            button: "Submit"
          },
          {
            type: "complete",
            title: "Module 1 Complete!",
            content: "Today you've built a complete mental model of how the modern web works.\n\nRecap: Web Development -> Frontend -> Backend -> Full Stack -> Website vs Web App -> Static vs Dynamic -> Client & Server -> Browser, Domain, DNS & Hosting -> Request & Response -> HTTP & HTTPS -> APIs & JSON -> Cookies, Sessions & JWT -> CORS.\n\nFeature Unlocked: You understand the big picture of the web before going deeper.",
            next: "Module 2",
            button: "Start Module 2"
          }
        ],
      },
      check: {
        question: "Why does CORS exist?",
        options: ["To slow down websites", "To protect users by controlling which websites can access resources", "To replace HTTP"],
        answerIndex: 1,
        explanation: "CORS helps browsers protect users by controlling whether one website can access resources from another website.",
      },
    },
  ],
};

module.exports = moduleOneJourney;
