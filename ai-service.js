const OpenAI = require('openai');

// Initialize OpenAI client with enhanced configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30 second timeout
  maxRetries: 3,
});

// Enhanced goal analysis with deeper psychological insights
const analyzeGoals = async (goals) => {
  try {
    const prompt = `You are Dr. Sarah Chen, a renowned executive coach with 20+ years of experience working with Fortune 500 leaders. You have a PhD in Organizational Psychology and specialize in leadership development.

LEADERSHIP GOALS TO ANALYZE:
"${goals}"

Your task is to provide a nuanced, personalized analysis that demonstrates deep understanding of leadership psychology and development.

ANALYSIS FRAMEWORK:
1. Identify the core leadership competencies mentioned or implied
2. Recognize the emotional/psychological drivers behind these goals
3. Assess the developmental stage and readiness for growth
4. Understand the organizational context and challenges
5. Design a specific, actionable first step that builds momentum

RESPONSE REQUIREMENTS:
- Write in a warm, professional tone that shows genuine understanding
- Reference specific elements from their goals to show you've listened carefully
- Provide insights that feel personally relevant and meaningful
- Create a first action that is both specific and psychologically engaging
- Demonstrate expertise without being condescending

Respond in this exact format:
FEEDBACK: [2-3 sentences showing deep understanding of their leadership aspirations, including insights about what's driving these goals and why they matter for their development]
ACTION: [One specific, actionable item for week 1 that directly connects to their stated goals and will create meaningful progress]`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are Dr. Sarah Chen, an expert executive coach specializing in leadership development. You provide nuanced, psychologically-informed coaching that helps leaders achieve breakthrough results. Your approach combines deep empathy with practical wisdom."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 400,
      temperature: 0.7,
      presence_penalty: 0.6,
      frequency_penalty: 0.3
    });

    const content = response.choices[0].message.content.trim();
    
    // Parse the response with enhanced validation
    const feedbackMatch = content.match(/FEEDBACK:\s*(.+?)(?=ACTION:|$)/s);
    const actionMatch = content.match(/ACTION:\s*(.+)/s);
    
    const feedback = feedbackMatch ? feedbackMatch[1].trim() : 
      "I can see the intentionality behind your leadership goals. What strikes me most is your commitment to growth and your recognition that great leadership requires continuous development.";
    
    const firstAction = actionMatch ? actionMatch[1].trim() : 
      "This week, spend 20 minutes writing about a recent leadership moment that didn't go as well as you'd hoped. What would you do differently now, and what does this reveal about the leader you're becoming?";
    
    return { feedback, firstAction };
    
  } catch (error) {
    console.error('Error analyzing goals:', error);
    
    // Enhanced fallback with more personalization
    return {
      feedback: "Thank you for sharing such thoughtful leadership goals with me. I can sense your genuine commitment to growth and your understanding that effective leadership is both an art and a skill that requires intentional development.",
      firstAction: "This week, identify one specific leadership interaction you have regularly (team meetings, one-on-ones, decision-making moments) and observe your natural patterns. What do you do well, and where do you sense there's room for growth?"
    };
  }
};

// Sophisticated weekly email generation with psychological continuity
const generateWeeklyEmail = async ({ goals, weekNumber, previousAction, previousActions = [], userContext = {} }) => {
  try {
    // Build rich context about the user's journey
    const journeyContext = buildJourneyContext(weekNumber, previousActions);
    const developmentalStage = determineDevelopmentalStage(weekNumber);
    const focusArea = determineFocusArea(weekNumber, goals);
    
    const prompt = `You are Dr. Sarah Chen, continuing your coaching relationship with a leader in week ${weekNumber} of their 12-week development journey.

LEADERSHIP CONTEXT:
Original Goals: "${goals}"
Current Week: ${weekNumber} of 12
Previous Action: "${previousAction || 'None yet'}"
Journey So Far: ${journeyContext}
Developmental Focus: ${developmentalStage}
This Week's Theme: ${focusArea}

COACHING PHILOSOPHY:
You believe in progressive skill building, where each week builds psychological momentum and practical competence. You understand that leadership development happens through:
1. Self-awareness (weeks 1-3)
2. Skill application (weeks 4-8) 
3. Integration and mastery (weeks 9-12)

Your approach is:
- Psychologically sophisticated yet practical
- Builds on previous learning systematically
- Recognizes both progress and challenges
- Creates specific, actionable steps
- Maintains optimal challenge level (not too easy, not overwhelming)

WEEKLY EMAIL REQUIREMENTS:
1. ACKNOWLEDGMENT: Reference their previous action specifically and meaningfully
2. PROGRESSION: Show how this week builds on their journey
3. ACTION DESIGN: Create an action that:
   - Directly serves their original goals
   - Matches their developmental stage
   - Feels personally relevant and engaging
   - Has clear success criteria
   - Takes 30-60 minutes to complete
4. CONNECTION: Explicitly tie this week's work to their bigger leadership vision

PSYCHOLOGICAL SOPHISTICATION:
- Vary the challenge level appropriately for week ${weekNumber}
- Use insights from leadership psychology and development theory
- Reference specific elements from their goals
- Show understanding of the cumulative nature of their growth
- Balance support with appropriate challenge

Respond in this exact format:
PRAISE: [2-4 words of specific acknowledgment that shows you understand what they accomplished]
ACTION: [One sophisticated, specific action item designed for their developmental stage and goals]
CONNECTION: [One sentence that powerfully connects this week's action to their original leadership vision and long-term growth]`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are Dr. Sarah Chen, an expert executive coach with deep knowledge of leadership psychology, adult development theory, and progressive skill building. You create coaching experiences that feel personally meaningful and create lasting behavioral change."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 350,
      temperature: 0.8,
      presence_penalty: 0.7,
      frequency_penalty: 0.4,
      top_p: 0.9
    });

    const content = response.choices[0].message.content.trim();
    
    // Enhanced parsing with validation
    const praiseMatch = content.match(/PRAISE:\s*(.+?)(?=ACTION:|$)/s);
    const actionMatch = content.match(/ACTION:\s*(.+?)(?=CONNECTION:|$)/s);
    const connectionMatch = content.match(/CONNECTION:\s*(.+)/s);
    
    const encouragement = praiseMatch ? praiseMatch[1].trim() : 
      getContextualPraise(weekNumber, previousAction);
    
    const actionItem = actionMatch ? actionMatch[1].trim() : 
      generateProgressiveAction(weekNumber, goals);
    
    const goalConnection = connectionMatch ? connectionMatch[1].trim() : 
      createMeaningfulConnection(weekNumber, goals);
    
    // Validate the response quality
    if (!validateActionQuality(actionItem, weekNumber)) {
      console.warn('Generated action may not meet quality standards, using fallback');
      return generateFallbackWeeklyContent(weekNumber, goals, previousAction);
    }
    
    return {
      encouragement,
      actionItem,
      goalConnection
    };
    
  } catch (error) {
    console.error('Error generating weekly email:', error);
    return generateFallbackWeeklyContent(weekNumber, goals, previousAction);
  }
};

// Build rich context about the user's learning journey
const buildJourneyContext = (weekNumber, previousActions) => {
  if (weekNumber <= 1) return "Beginning their leadership development journey";
  if (weekNumber <= 3) return "Building foundational self-awareness";
  if (weekNumber <= 6) return "Developing core leadership skills through practice";
  if (weekNumber <= 9) return "Integrating new behaviors and refining their approach";
  return "Mastering advanced leadership capabilities and preparing for sustained excellence";
};

// Determine appropriate developmental stage and focus
const determineDevelopmentalStage = (weekNumber) => {
  const stages = {
    1: "Self-Discovery & Awareness Building",
    2: "Pattern Recognition & Insight Development", 
    3: "Foundational Skill Identification",
    4: "Active Skill Practice & Application",
    5: "Feedback Integration & Refinement",
    6: "Confidence Building & Consistency",
    7: "Advanced Skill Development",
    8: "Leadership Presence & Influence",
    9: "Integration & Synthesis",
    10: "Mastery & Optimization",
    11: "Sustainable Excellence & Future Planning",
    12: "Legacy & Continuous Growth Mindset"
  };
  
  return stages[weekNumber] || "Continued Development";
};

// Determine sophisticated focus area based on week and goals
const determineFocusArea = (weekNumber, goals) => {
  const goalKeywords = goals.toLowerCase();
  
  // Extract key themes from goals
  const themes = {
    communication: goalKeywords.includes('communication') || goalKeywords.includes('feedback') || goalKeywords.includes('listening'),
    team: goalKeywords.includes('team') || goalKeywords.includes('collaboration') || goalKeywords.includes('relationship'),
    decision: goalKeywords.includes('decision') || goalKeywords.includes('strategic') || goalKeywords.includes('problem'),
    influence: goalKeywords.includes('influence') || goalKeywords.includes('persuade') || goalKeywords.includes('inspire'),
    emotional: goalKeywords.includes('emotional') || goalKeywords.includes('empathy') || goalKeywords.includes('trust'),
    development: goalKeywords.includes('develop') || goalKeywords.includes('mentor') || goalKeywords.includes('coach')
  };
  
  // Progressive focus areas that build on each other
  const weeklyFocus = [
    "Self-Awareness & Leadership Identity",
    "Communication Foundations", 
    "Relationship Dynamics",
    "Decision-Making Confidence",
    "Influence & Persuasion",
    "Team Effectiveness",
    "Emotional Intelligence Application",
    "Strategic Thinking",
    "Change Leadership",
    "Advanced Influence",
    "Leadership Legacy",
    "Sustainable Excellence"
  ];
  
  let baseFocus = weeklyFocus[weekNumber - 1] || "Leadership Development";
  
  // Customize based on their specific goals
  if (themes.communication && weekNumber >= 4) {
    baseFocus = baseFocus.replace("Team Effectiveness", "Communication Mastery");
  }
  if (themes.emotional && weekNumber >= 6) {
    baseFocus = baseFocus.replace("Strategic Thinking", "Emotional Leadership");
  }
  
  return baseFocus;
};

// Generate contextually appropriate praise
const getContextualPraise = (weekNumber, previousAction) => {
  if (!previousAction) return "Great start";
  
  const praises = [
    "Excellent self-reflection", "Meaningful progress", "Strong commitment", "Thoughtful approach",
    "Impressive insight", "Solid foundation built", "Notable growth", "Powerful awareness",
    "Genuine breakthrough", "Consistent excellence", "Remarkable transformation", "Outstanding mastery"
  ];
  
  // Select praise based on week progression
  const index = Math.min(weekNumber - 1, praises.length - 1);
  return praises[index];
};

// Generate sophisticated, progressive actions
const generateProgressiveAction = (weekNumber, goals) => {
  const goalThemes = extractGoalThemes(goals);
  const actions = createWeeklyActionProgression(goalThemes);
  return actions[weekNumber - 1] || actions[actions.length - 1];
};

// Extract themes from goals using NLP-style analysis
const extractGoalThemes = (goals) => {
  const text = goals.toLowerCase();
  const themes = [];
  
  if (text.match(/communicat|feedback|listen|speak/)) themes.push('communication');
  if (text.match(/team|collaborat|relationship|trust/)) themes.push('team');
  if (text.match(/decision|strategic|problem|think/)) themes.push('decision');
  if (text.match(/influence|persuad|inspire|motivat/)) themes.push('influence');
  if (text.match(/emotional|empathy|understanding|connect/)) themes.push('emotional');
  if (text.match(/develop|mentor|coach|grow|learn/)) themes.push('development');
  if (text.match(/conflict|difficult|challenging|tough/)) themes.push('conflict');
  if (text.match(/vision|future|strategy|direction/)) themes.push('vision');
  
  return themes.length > 0 ? themes : ['general'];
};

// Create sophisticated weekly action progressions
const createWeeklyActionProgression = (themes) => {
  const baseActions = [
    "Create a 'leadership moments journal' and record three specific situations this week where you exercised leadership (formal or informal). For each, note: What happened? What did you do well? What would you enhance next time?",
    
    "Conduct a 'leadership 360' self-assessment: Ask yourself how three different people (a peer, a direct report, and your manager) would describe your leadership style. Write down what you think each would say, then identify one insight that surprises you.",
    
    "Practice 'intentional leadership presence' in one recurring meeting this week. Before the meeting, set a specific intention for how you want to show up as a leader. Afterward, reflect on the gap between intention and impact.",
    
    "Implement a 'micro-feedback experiment': Give one piece of specific, actionable feedback to someone this week, focusing on behavior and impact rather than personality. Notice both their response and your own comfort level with the conversation.",
    
    "Design and execute a 'listening challenge': In your next three conversations with team members, focus entirely on understanding their perspective before sharing your own. Track what you learn that you might have missed otherwise.",
    
    "Create a 'decision-making framework audit': Review a recent important decision you made. Map out the process you used, the stakeholders you consulted, and the criteria you applied. Identify one way to strengthen your approach for future decisions.",
    
    "Practice 'leadership coaching': Have a development conversation with someone on your team where you ask questions to help them solve their own problem rather than giving advice. Notice the difference in engagement and ownership.",
    
    "Conduct a 'influence assessment': Identify a situation where you need to create change or buy-in. Map out the stakeholders, their motivations, and concerns. Design an influence strategy that addresses their specific needs and perspectives.",
    
    "Execute a 'team effectiveness experiment': Introduce one new practice in your team that you believe will improve collaboration, communication, or results. Implement it for one week and gather feedback on its impact.",
    
    "Design a 'leadership challenge response': Identify the most significant leadership challenge you're currently facing. Create a detailed action plan with specific steps, success metrics, and timeline. Begin implementing the first step this week.",
    
    "Develop your 'leadership legacy vision': Write a detailed description of the leader you want to be remembered as. Include the impact you want to have on people, teams, and the organization. Identify three specific behaviors you need to strengthen to realize this vision.",
    
    "Create a 'sustainable excellence plan': Design a personal system for maintaining and continuing your leadership growth beyond this program. Include specific practices for self-reflection, feedback gathering, skill development, and accountability."
  ];
  
  // Customize actions based on user's specific themes
  if (themes.includes('communication')) {
    baseActions[1] = "Focus specifically on communication: Ask three different people for honest feedback about your communication style. What do they appreciate? What would they like to see more of? Look for patterns across their responses.";
    baseActions[4] = "Master 'communication clarity': Before your next three important conversations, write down your key message in one sentence. During the conversation, check for understanding by asking 'What questions do you have?' rather than 'Does that make sense?'";
  }
  
  if (themes.includes('team')) {
    baseActions[2] = "Practice 'team leadership presence': In your next team interaction, focus on creating psychological safety. Notice your body language, tone, and word choice. How do these elements invite or discourage team member participation?";
    baseActions[6] = "Conduct a 'team dynamics assessment': Observe your team's interaction patterns for one week. Who speaks first? Who stays quiet? How does the team handle disagreement? What does this reveal about the culture you're creating as a leader?";
  }
  
  if (themes.includes('decision')) {
    baseActions[5] = "Implement 'transparent decision-making': For your next significant decision, clearly communicate your decision-making process to those affected. Share what criteria you're using, what information you need, and how they can provide input.";
  }
  
  return baseActions;
};

// Create meaningful connections to long-term goals
const createMeaningfulConnection = (weekNumber, goals) => {
  const connections = [
    "This self-awareness work creates the foundation for all leadership growth that follows.",
    "Understanding your patterns is essential for making the intentional changes you described in your goals.",
    "This practice builds the leadership presence that will amplify everything else you do.",
    "Feedback skills are central to creating the impact you want to have as a leader.",
    "Deep listening transforms relationships and unlocks the collaborative leadership you're developing.",
    "Strong decision-making processes build the confidence and trust that great leaders require.",
    "Coaching others develops your ability to multiply your impact through empowering others.",
    "Mastering influence is crucial for turning your leadership vision into reality.",
    "Team effectiveness work directly advances the collaborative leadership goals you've set.",
    "Tackling complex challenges builds the resilience and capability you need for senior leadership.",
    "Your leadership legacy vision will guide your continued growth long after this program ends.",
    "These sustainable practices ensure that your leadership development becomes a lifelong competitive advantage."
  ];
  
  return connections[weekNumber - 1] || "This work directly serves the leadership transformation you're committed to creating.";
};

// Validate action quality to ensure sophistication
const validateActionQuality = (action, weekNumber) => {
  if (!action || action.length < 50) return false;
  if (!action.includes(' ')) return false; // Should be substantial
  if (action.toLowerCase().includes('take 15 minutes')) return false; // Avoid generic timing
  if (!action.match(/specific|particular|concrete|detailed|measurable/i)) {
    // Check if action has specific elements even without these keywords
    const hasSpecificity = action.match(/one|three|next|this week|identify|create|implement|practice|conduct/);
    if (!hasSpecificity) return false;
  }
  return true;
};

// Enhanced fallback content with personalization
const generateFallbackWeeklyContent = (weekNumber, goals, previousAction) => {
  const fallbackActions = [
    "Create a detailed reflection on a recent leadership moment: What was the situation, what did you do, what was the impact, and what would you do differently with your current knowledge?",
    
    "Identify three people whose leadership you admire and analyze what specific behaviors or qualities make them effective. How can you integrate one of these qualities into your own approach this week?",
    
    "Practice deliberate leadership presence in one recurring situation this week. Set a clear intention for how you want to show up, then reflect on the alignment between your intention and your actual impact.",
    
    "Design and implement a feedback conversation with someone on your team. Focus on specific behaviors and their impact, and create space for dialogue rather than just delivering your message.",
    
    "Conduct a 'listening assessment' in your next three professional conversations. Focus entirely on understanding the other person's perspective before sharing your own views. What do you learn that you might have missed?",
    
    "Analyze a recent decision you made by mapping out your decision-making process. What criteria did you use? Who did you consult? How can you strengthen your approach for future decisions?",
    
    "Practice leadership coaching by having a development conversation with someone where you ask questions to help them find their own solutions rather than giving direct advice.",
    
    "Develop an influence strategy for a current challenge. Map out the stakeholders, their motivations and concerns, and design an approach that addresses their specific needs.",
    
    "Introduce one new practice to improve team effectiveness. Implement it for one week and gather specific feedback about its impact on collaboration and results.",
    
    "Identify your most significant current leadership challenge and create a detailed action plan with specific steps, success metrics, and timeline. Begin implementing the first step.",
    
    "Write a comprehensive vision of the leader you want to become. Include the impact you want to have and identify three specific behaviors you need to develop to realize this vision.",
    
    "Design a personal system for sustaining your leadership growth beyond this program. Include specific practices for reflection, feedback, skill development, and accountability."
  ];
  
  const encouragements = [
    "Excellent start", "Strong foundation", "Meaningful progress", "Thoughtful approach",
    "Impressive insight", "Notable growth", "Powerful awareness", "Genuine breakthrough",
    "Consistent excellence", "Remarkable development", "Outstanding commitment", "Exceptional growth"
  ];
  
  const connections = [
    "This foundational work accelerates all the leadership growth that follows.",
    "Building this awareness is essential for achieving the goals you've set.",
    "This practice develops the presence needed for the leadership impact you're creating.",
    "These skills are central to the collaborative leadership approach you're building.",
    "This deepens the authentic connection that underlies all effective leadership.",
    "This builds the decision-making confidence that great leaders require.",
    "Developing others is key to multiplying your leadership impact.",
    "Mastering influence is crucial for turning your vision into reality.",
    "This team focus directly serves the collaborative leadership you're developing.",
    "Taking on complex challenges builds the capabilities needed for senior leadership.",
    "This vision work ensures your growth continues long beyond this program.",
    "These practices create the sustainable excellence that defines great leaders."
  ];
  
  const index = Math.min(weekNumber - 1, fallbackActions.length - 1);
  
  return {
    encouragement: encouragements[index],
    actionItem: fallbackActions[index],
    goalConnection: connections[index]
  };
};

// Enhanced subject line generation with psychological sophistication
const generateSubjectLine = async (weekNumber, goals, actionTheme) => {
  try {
    const prompt = `Create an engaging email subject line for week ${weekNumber} of a 12-week leadership development program.

Context:
- Week ${weekNumber} of 12
- Goals: ${goals}
- Action theme: ${actionTheme}

Requirements:
- 6-8 words maximum
- Create curiosity and motivation
- Reference the week number
- Feel personal and relevant
- Avoid generic phrases
- Match the sophisticated coaching tone

Examples of great subject lines:
- "Week 3: Your leadership presence breakthrough"
- "Week 7: The influence strategy that works"
- "Week 10: Your decision-making evolution"

Subject line:`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You create compelling, sophisticated email subject lines for executive coaching that drive engagement and convey value."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 50,
      temperature: 0.9
    });

    let subjectLine = response.choices[0].message.content.trim();
    
    // Clean up the response
    subjectLine = subjectLine.replace(/^(Subject line:|Subject:)/i, '').trim();
    subjectLine = subjectLine.replace(/^["']|["']$/g, ''); // Remove quotes
    
    // Validate and fallback if needed
    if (!subjectLine || subjectLine.length > 50) {
      return `Week ${weekNumber}: Your leadership breakthrough awaits`;
    }
    
    return subjectLine;
    
  } catch (error) {
    console.error('Error generating subject line:', error);
    return `Week ${weekNumber}: Continue your leadership journey`;
  }
};

// Test AI service with enhanced validation
const testAIService = async () => {
  console.log('Testing enhanced AI service...');
  
  try {
    // Test goal analysis
    console.log('Testing sophisticated goal analysis...');
    const testGoals = "I want to become a more effective communicator who can build trust with my team while also developing the confidence to give difficult feedback when necessary. I struggle with balancing being supportive with holding people accountable.";
    
    const goalAnalysis = await analyzeGoals(testGoals);
    console.log('Goal Analysis Result:', goalAnalysis);
    
    if (!goalAnalysis.feedback || !goalAnalysis.firstAction) {
      throw new Error('Goal analysis failed validation');
    }
    
    // Test weekly email generation
    console.log('\nTesting sophisticated weekly email generation...');
    const weeklyContent = await generateWeeklyEmail({
      goals: testGoals,
      weekNumber: 3,
      previousAction: "Conducted a self-assessment of communication patterns by recording observations after each team interaction for one week",
      previousActions: [
        "Created a leadership moments journal and identified three key areas for development",
        "Conducted a self-assessment of communication patterns by recording observations after each team interaction for one week"
      ]
    });
    
    console.log('Weekly Email Result:', weeklyContent);
    
    if (!weeklyContent.actionItem || !weeklyContent.goalConnection) {
      throw new Error('Weekly email generation failed validation');
    }
    
    // Test subject line generation
    console.log('\nTesting subject line generation...');
    const subjectLine = await generateSubjectLine(3, testGoals, "Communication Mastery");
    console.log('Subject Line Result:', subjectLine);
    
    console.log('\n✅ Enhanced AI service test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Enhanced AI service test failed:', error);
    return false;
  }
};

// Export enhanced functions
module.exports = {
  analyzeGoals,
  generateWeeklyEmail,
  generateSubjectLine,
  testAIService
};

// Generate initial goal analysis for welcome email
const analyzeGoals = async (goals) => {
  try {
    const prompt = `You are an experienced leadership coach reviewing someone's leadership goals. 
    
Analyze these goals and provide constructive, encouraging feedback in 2-3 sentences, then suggest one specific, actionable item they can complete in their first week.

Goals: ${goals}

Respond in this exact format:
FEEDBACK: [Your analysis and encouragement in 2-3 sentences]
ACTION: [One specific action item they can complete in week 1]`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a supportive leadership coach who provides practical, actionable advice. Keep your tone encouraging and professional."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.7
    });

    const content = response.choices[0].message.content.trim();
    
    // Parse the response
    const feedbackMatch = content.match(/FEEDBACK:\s*(.+?)(?=ACTION:|$)/s);
    const actionMatch = content.match(/ACTION:\s*(.+)/s);
    
    return {
      feedback: feedbackMatch ? feedbackMatch[1].trim() : "I'm excited to help you achieve your leadership goals!",
      firstAction: actionMatch ? actionMatch[1].trim() : "Take 15 minutes to reflect on your current leadership strengths and areas for growth."
    };
    
  } catch (error) {
    console.error('Error analyzing goals:', error);
    
    // Fallback response if AI fails
    return {
      feedback: "Thank you for sharing your leadership goals with me. I'm here to support you on this journey over the next 12 weeks.",
      firstAction: "This week, identify one specific leadership skill you'd like to improve and write down why it's important to you."
    };
  }
};

// Generate weekly email content
const generateWeeklyEmail = async ({ goals, weekNumber, previousAction, previousActions = [] }) => {
  try {
    const prompt = `You are a consistent, encouraging leadership coach helping someone achieve their goals over a 12-week program.

Context:
- Original goals: ${goals}
- Current week: ${weekNumber} of 12
- Last week's action: ${previousAction || 'No previous action'}
- Previous actions taken: ${previousActions.length > 0 ? previousActions.join('; ') : 'None yet'}

Generate content for this week's email with:

1. Brief acknowledgment of last week's action (2-3 words of praise like "Great work" or "Well done")
2. One specific, actionable item for this week that builds on their progress
3. A sentence connecting this week's action to their original goals

Requirements:
- Action item must be specific and completable in one week
- Avoid repeating previous actions exactly
- Build progression week by week
- Keep tone encouraging but concise
- Focus on practical leadership development

Respond in this exact format:
PRAISE: [2-3 words of encouragement for last week]
ACTION: [Specific action item for this week]
CONNECTION: [How this connects to their original goals]`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a skilled leadership development coach focused on practical, progressive skill building. Your advice should be specific, actionable, and build logically from week to week."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 250,
      temperature: 0.7
    });

    const content = response.choices[0].message.content.trim();
    
    // Parse the response
    const praiseMatch = content.match(/PRAISE:\s*(.+?)(?=ACTION:|$)/s);
    const actionMatch = content.match(/ACTION:\s*(.+?)(?=CONNECTION:|$)/s);
    const connectionMatch = content.match(/CONNECTION:\s*(.+)/s);
    
    return {
      encouragement: praiseMatch ? praiseMatch[1].trim() : "Great progress",
      actionItem: actionMatch ? actionMatch[1].trim() : generateFallbackAction(weekNumber),
      goalConnection: connectionMatch ? connectionMatch[1].trim() : "This builds on your leadership development journey."
    };
    
  } catch (error) {
    console.error('Error generating weekly email:', error);
    
    // Fallback content if AI fails
    return {
      encouragement: "Keep going",
      actionItem: generateFallbackAction(weekNumber),
      goalConnection: "Every small step moves you closer to your leadership goals."
    };
  }
};

// Generate fallback actions for each week if AI fails
const generateFallbackAction = (weekNumber) => {
  const fallbackActions = [
    "Take 15 minutes to identify one leadership strength you want to develop further this week.",
    "Have a meaningful one-on-one conversation with someone on your team or in your network.",
    "Practice active listening in your next meeting - focus entirely on understanding before responding.",
    "Ask for feedback from someone you trust about your leadership style.",
    "Identify one process or decision you can delegate to develop someone else's skills.",
    "Schedule 30 minutes to reflect on a recent challenge and what you learned from it.",
    "Reach out to a mentor or leader you admire and ask them one specific question.",
    "Practice giving constructive feedback to someone who would benefit from it.",
    "Identify one limiting belief about your leadership and challenge it this week.",
    "Set up a system to regularly check in with your team's goals and progress.",
    "Practice saying no to one request that doesn't align with your priorities.",
    "Create a development plan for yourself based on everything you've learned."
  ];
  
  // Return action for the week (array is 0-indexed, weeks are 1-indexed)
  const actionIndex = Math.min(weekNumber - 1, fallbackActions.length - 1);
  return fallbackActions[actionIndex];
};

// Test AI service functionality
const testAIService = async () => {
  console.log('Testing AI service...');
  
  try {
    // Test goal analysis
    console.log('Testing goal analysis...');
    const testGoals = "I want to become a better communicator and learn how to give constructive feedback to my team members.";
    const goalAnalysis = await analyzeGoals(testGoals);
    console.log('Goal Analysis Result:', goalAnalysis);
    
    // Test weekly email generation
    console.log('\nTesting weekly email generation...');
    const weeklyContent = await generateWeeklyEmail({
      goals: testGoals,
      weekNumber: 3,
      previousAction: "Had a one-on-one meeting with each team member",
      previousActions: ["Identified communication strengths", "Had a one-on-one meeting with each team member"]
    });
    console.log('Weekly Email Result:', weeklyContent);
    
    console.log('\nAI service test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('AI service test failed:', error);
    return false;
  }
};

// Validate AI response format
const validateResponse = (response, expectedFields) => {
  for (const field of expectedFields) {
    if (!response[field] || typeof response[field] !== 'string' || response[field].trim().length === 0) {
      console.warn(`AI response missing or invalid field: ${field}`);
      return false;
    }
  }
  return true;
};

// Get personalized subject line for email
const generateSubjectLine = async (weekNumber, goals) => {
  try {
    const prompt = `Create a short, engaging email subject line for week ${weekNumber} of a 12-week leadership development program. 

Context: The person is working on these goals: ${goals}

Requirements:
- 6-8 words maximum
- Encouraging and action-oriented
- Include "Week ${weekNumber}" 
- No generic phrases like "Keep going" or "Don't give up"

Examples:
- Week 3: Your communication skills are growing
- Week 5: Time to practice difficult conversations
- Week 8: Leading through uncertainty starts now

Subject line:`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a marketing expert creating engaging email subject lines for leadership development content."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 50,
      temperature: 0.8
    });

    const subjectLine = response.choices[0].message.content.trim();
    
    // Validate and clean up
    if (subjectLine && subjectLine.length > 0) {
      return subjectLine.replace(/^(Subject line:|Subject:)/i, '').trim();
    }
    
    // Fallback
    return `Week ${weekNumber}: Keep the momentum going!`;
    
  } catch (error) {
    console.error('Error generating subject line:', error);
    return `Week ${weekNumber}: Keep the momentum going!`;
  }
};

// Export all functions
module.exports = {
  analyzeGoals,
  generateWeeklyEmail,
  generateSubjectLine,
  testAIService
};