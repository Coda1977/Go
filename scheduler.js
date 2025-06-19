const cron = require('node-cron');
const { getActiveUsers, updateUserWeek, getEmailHistory } = require('./database');
const { generateWeeklyEmail, generateSubjectLine } = require('./aiService');
const { sendEmail } = require('./emailService');

// Schedule weekly emails for Monday at 9 AM in each user's timezone
// This runs every hour to check for users who need emails
const scheduleWeeklyEmails = () => {
  // Run every hour on the hour
  cron.schedule('0 * * * *', async () => {
    console.log('Checking for users who need weekly emails...');
    await processWeeklyEmails();
  }, {
    scheduled: true,
    timezone: "UTC"
  });
  
  console.log('Weekly email scheduler started - checking hourly for users needing emails');
};

// Enhanced weekly email processing with intelligent AI integration
const processWeeklyEmails = async () => {
  try {
    const users = await getActiveUsers();
    const now = new Date();
    let processedCount = 0;
    let errorCount = 0;
    
    console.log(`Processing ${users.length} active users for weekly emails...`);
    
    for (const user of users) {
      try {
        if (await shouldSendWeeklyEmail(user, now)) {
          const success = await sendWeeklyEmailToUser(user);
          if (success) {
            processedCount++;
            console.log(`✅ Week ${user.current_week + 1} email sent to ${user.email}`);
          } else {
            errorCount++;
            console.error(`❌ Failed to send email to ${user.email}`);
          }
          
          // Small delay between emails to avoid overwhelming the AI service
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        errorCount++;
        console.error(`Error processing email for user ${user.id}:`, error);
        // Continue with other users even if one fails
      }
    }
    
    console.log(`Weekly email processing completed: ${processedCount} sent, ${errorCount} errors`);
    return { processedCount, errorCount, totalUsers: users.length };
    
  } catch (error) {
    console.error('Error in processWeeklyEmails:', error);
    throw error;
  }
};

// Determine if a user should receive their weekly email now
const shouldSendWeeklyEmail = async (user, currentTime) => {
  // Skip if user has completed 12 weeks
  if (user.current_week >= 12) {
    return false;
  }
  
  // Get user's current time
  const userTime = getUserLocalTime(currentTime, user.timezone);
  const dayOfWeek = userTime.getDay(); // 0 = Sunday, 1 = Monday
  const hour = userTime.getHours();
  
  // Only send on Mondays at 9 AM (with 1-hour window)
  if (dayOfWeek !== 1 || hour !== 9) {
    return false;
  }
  
  // Check if we already sent an email this week
  const lastEmailDate = user.last_email_sent ? new Date(user.last_email_sent) : null;
  if (lastEmailDate) {
    const daysSinceLastEmail = Math.floor((currentTime - lastEmailDate) / (1000 * 60 * 60 * 24));
    if (daysSinceLastEmail < 6) { // Wait at least 6 days between emails
      return false;
    }
  }
  
  return true;
};

// Get user's local time based on their timezone
const getUserLocalTime = (utcTime, timezone) => {
  try {
    return new Date(utcTime.toLocaleString("en-US", { timeZone: timezone }));
  } catch (error) {
    console.error(`Invalid timezone ${timezone}, using UTC`);
    return utcTime;
  }
};

// Enhanced weekly email sending with sophisticated AI integration
const sendWeeklyEmailToUser = async (user) => {
  try {
    const weekNumber = user.current_week + 1;
    console.log(`Generating sophisticated weekly email for user ${user.id} (week ${weekNumber})`);
    
    // Get comprehensive user email history for context
    const emailHistory = await getEmailHistory(user.id, 12); // Get all history for full context
    
    // Build rich context about user's journey
    const previousActions = emailHistory
      .filter(email => email.action_item && email.action_item.trim().length > 0)
      .sort((a, b) => new Date(b.sent_date) - new Date(a.sent_date))
      .map(email => email.action_item)
      .slice(0, 5); // Last 5 actions for context
    
    const lastAction = previousActions.length > 0 ? previousActions[0] : null;
    
    // Create enhanced user context for AI
    const userContext = {
      totalEmailsSent: emailHistory.length,
      engagementLevel: assessEngagementLevel(emailHistory),
      progressPattern: analyzeProgressPattern(emailHistory, weekNumber),
      goalComplexity: assessGoalComplexity(user.goals)
    };
    
    // Generate sophisticated AI content with full context
    console.log(`Generating AI content for ${user.email}, week ${weekNumber}...`);
    const aiContent = await generateWeeklyEmail({
      goals: user.goals,
      weekNumber: weekNumber,
      previousAction: lastAction,
      previousActions: previousActions,
      userContext: userContext
    });
    
    // Generate intelligent subject line
    const subjectLine = await generateSubjectLine(
      weekNumber, 
      user.goals, 
      extractActionTheme(aiContent.actionItem)
    );
    
    // Create comprehensive email data
    const emailData = {
      to: user.email,
      subject: subjectLine,
      weekNumber: weekNumber,
      totalWeeks: 12,
      previousAction: lastAction,
      encouragement: aiContent.encouragement,
      newAction: aiContent.actionItem,
      goalConnection: aiContent.goalConnection,
      userGoals: user.goals,
      progressPercent: Math.round((weekNumber / 12) * 100)
    };
    
    // Send the sophisticated email
    const emailSent = await sendEmail(emailData, 'weekly');
    
    if (emailSent) {
      // Update user's progress with the new action item
      await updateUserWeek(user.id, weekNumber, aiContent.actionItem);
      
      // Log successful delivery with enhanced metadata
      console.log(`✅ Sophisticated week ${weekNumber} email delivered to ${user.email}`, {
        actionTheme: extractActionTheme(aiContent.actionItem),
        subjectLine: subjectLine,
        contextLevel: userContext.engagementLevel
      });
      
      return true;
    } else {
      console.error(`❌ Failed to deliver email to ${user.email}`);
      return false;
    }
    
  } catch (error) {
    console.error(`Error sending sophisticated weekly email to user ${user.id}:`, error);
    
    // Fallback: Try to send a simpler email if AI fails
    try {
      console.log('Attempting fallback email delivery...');
      const fallbackResult = await sendFallbackEmail(user);
      return fallbackResult;
    } catch (fallbackError) {
      console.error('Fallback email also failed:', fallbackError);
      return false;
    }
  }
};

// Assess user engagement level for personalized AI generation
const assessEngagementLevel = (emailHistory) => {
  if (emailHistory.length === 0) return 'new';
  if (emailHistory.length <= 2) return 'getting_started';
  if (emailHistory.length <= 6) return 'building_momentum';
  if (emailHistory.length <= 9) return 'actively_engaged';
  return 'highly_committed';
};

// Analyze user's progress patterns for AI context
const analyzeProgressPattern = (emailHistory, currentWeek) => {
  if (emailHistory.length === 0) return 'beginning';
  
  const expectedEmails = currentWeek - 1;
  const actualEmails = emailHistory.length;
  
  if (actualEmails >= expectedEmails) return 'consistent';
  if (actualEmails >= expectedEmails * 0.7) return 'mostly_consistent';
  return 'irregular';
};

// Assess goal complexity for appropriate AI response sophistication
const assessGoalComplexity = (goals) => {
  const text = goals.toLowerCase();
  const complexityIndicators = [
    'strategic', 'influence', 'organizational', 'culture', 'transformation',
    'complex', 'multiple', 'challenging', 'difficult', 'advanced'
  ];
  
  const matchCount = complexityIndicators.filter(indicator => text.includes(indicator)).length;
  
  if (matchCount >= 3) return 'high';
  if (matchCount >= 1) return 'medium';
  return 'foundational';
};

// Extract thematic elements from action items for subject line generation
const extractActionTheme = (actionItem) => {
  const text = actionItem.toLowerCase();
  
  if (text.includes('feedback') || text.includes('conversation')) return 'Communication Mastery';
  if (text.includes('team') || text.includes('collaboration')) return 'Team Leadership';
  if (text.includes('decision') || text.includes('strategy')) return 'Strategic Thinking';
  if (text.includes('influence') || text.includes('persuade')) return 'Leadership Influence';
  if (text.includes('coaching') || text.includes('develop')) return 'People Development';
  if (text.includes('presence') || text.includes('authority')) return 'Executive Presence';
  if (text.includes('vision') || text.includes('future')) return 'Visionary Leadership';
  if (text.includes('change') || text.includes('transformation')) return 'Change Leadership';
  
  return 'Leadership Growth';
};

// Fallback email system if AI fails
const sendFallbackEmail = async (user) => {
  try {
    const weekNumber = user.current_week + 1;
    console.log(`Sending fallback email for user ${user.id}, week ${weekNumber}`);
    
    const fallbackActions = [
      "Reflect on one leadership interaction from this week. What went well, and what would you approach differently next time?",
      "Identify three people whose leadership you admire. What specific qualities do they demonstrate that you'd like to develop?",
      "Practice active listening in your next team meeting. Focus entirely on understanding before responding.",
      "Give one piece of specific, constructive feedback to someone on your team this week.",
      "Ask a trusted colleague for honest feedback about your leadership style and areas for growth.",
      "Lead a team discussion about a current challenge, focusing on asking questions rather than providing answers.",
      "Observe your decision-making process this week. What patterns do you notice in how you approach choices?",
      "Practice delegating one task while providing clear context about why it matters.",
      "Have a development conversation with someone on your team about their career goals.",
      "Identify one process or practice your team could improve and facilitate a discussion about solutions.",
      "Reflect on your leadership legacy. What impact do you want to have on the people you lead?",
      "Create a plan for continuing your leadership development beyond this program."
    ];
    
    const encouragements = [
      "Great start", "Building momentum", "Strong progress", "Thoughtful approach",
      "Meaningful growth", "Excellent development", "Impressive commitment", "Notable evolution",
      "Powerful transformation", "Outstanding progress", "Remarkable journey", "Exceptional growth"
    ];
    
    const actionIndex = Math.min(weekNumber - 1, fallbackActions.length - 1);
    const encouragementIndex = Math.min(weekNumber - 1, encouragements.length - 1);
    
    const emailData = {
      to: user.email,
      subject: `Week ${weekNumber}: Your leadership development continues`,
      weekNumber: weekNumber,
      totalWeeks: 12,
      previousAction: "your previous leadership action",
      encouragement: encouragements[encouragementIndex],
      newAction: fallbackActions[actionIndex],
      goalConnection: "This week's focus builds directly on the leadership goals you've set for yourself.",
      progressPercent: Math.round((weekNumber / 12) * 100)
    };
    
    const emailSent = await sendEmail(emailData, 'weekly');
    
    if (emailSent) {
      await updateUserWeek(user.id, weekNumber, fallbackActions[actionIndex]);
      console.log(`✅ Fallback email sent successfully to ${user.email}`);
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error('Fallback email failed:', error);
    return false;
  }
};

// Manual function to send sophisticated email to specific user
const sendManualEmail = async (userId) => {
  try {
    const users = await getActiveUsers();
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      throw new Error(`User ${userId} not found or not active`);
    }
    
    console.log(`Manual sophisticated email trigger for user ${userId}`);
    const success = await sendWeeklyEmailToUser(user);
    
    if (success) {
      console.log(`✅ Manual sophisticated email sent successfully to user ${userId}`);
    } else {
      console.log(`❌ Manual sophisticated email failed for user ${userId}`);
    }
    
    return success;
  } catch (error) {
    console.error(`Error sending manual sophisticated email to user ${userId}:`, error);
    throw error;
  }
};

// Enhanced testing function for sophisticated scheduling
const testScheduling = async () => {
  console.log('Testing sophisticated scheduling logic...');
  
  const testUsers = [
    {
      id: 1,
      email: 'test@example.com',
      timezone: 'America/New_York',
      current_week: 2,
      last_email_sent: '2025-06-16T13:00:00Z',
      goals: 'I want to improve my communication skills and become a more effective team leader who can provide constructive feedback while building trust.'
    },
    {
      id: 2,
      email: 'test2@example.com', 
      timezone: 'Europe/London',
      current_week: 0,
      last_email_sent: null,
      goals: 'My goal is to develop strategic thinking abilities and learn how to influence stakeholders across the organization while maintaining authentic relationships.'
    }
  ];
  
  const now = new Date();
  
  for (const user of testUsers) {
    const shouldSend = await shouldSendWeeklyEmail(user, now);
    const userTime = getUserLocalTime(now, user.timezone);
    const goalComplexity = assessGoalComplexity(user.goals);
    const actionTheme = extractActionTheme('practice leadership feedback conversations');
    
    console.log(`User ${user.id} Analysis:`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Timezone: ${user.timezone}`);
    console.log(`  Local time: ${userTime.toLocaleString()}`);
    console.log(`  Should send email: ${shouldSend}`);
    console.log(`  Current week: ${user.current_week}`);
    console.log(`  Goal complexity: ${goalComplexity}`);
    console.log(`  Sample action theme: ${actionTheme}`);
    console.log('---');
  }
  
  // Test AI content generation
  console.log('\nTesting sophisticated AI content generation...');
  try {
    const { generateWeeklyEmail } = require('./aiService');
    const testContent = await generateWeeklyEmail({
      goals: testUsers[0].goals,
      weekNumber: 3,
      previousAction: "Conducted a communication style assessment by observing patterns in team meetings",
      previousActions: ["Reflected on leadership moments", "Conducted a communication style assessment"],
      userContext: {
        engagementLevel: 'building_momentum',
        progressPattern: 'consistent',
        goalComplexity: 'medium'
      }
    });
    
    console.log('AI Content Test Result:', {
      encouragement: testContent.encouragement,
      actionLength: testContent.actionItem.length,
      connectionQuality: testContent.goalConnection.length,
      hasPsychologicalDepth: testContent.actionItem.includes('specific') || testContent.actionItem.includes('observe') || testContent.actionItem.includes('reflect')
    });
    
  } catch (aiError) {
    console.error('AI content generation test failed:', aiError);
  }
  
  console.log('\n✅ Sophisticated scheduling test completed');
};

// Get upcoming emails with enhanced AI context prediction
const getUpcomingEmails = async () => {
  try {
    const users = await getActiveUsers();
    const now = new Date();
    const upcoming = [];
    
    for (const user of users) {
      if (user.current_week < 12) {
        const nextEmailTime = calculateNextEmailTime(user, now);
        const predictedTheme = predictNextActionTheme(user);
        const engagementLevel = await getEngagementLevel(user.id);
        
        upcoming.push({
          userId: user.id,
          email: user.email,
          currentWeek: user.current_week,
          nextWeek: user.current_week + 1,
          nextEmailTime: nextEmailTime,
          timezone: user.timezone,
          predictedTheme: predictedTheme,
          engagementLevel: engagementLevel,
          goalComplexity: assessGoalComplexity(user.goals)
        });
      }
    }
    
    // Sort by next email time
    upcoming.sort((a, b) => new Date(a.nextEmailTime) - new Date(b.nextEmailTime));
    
    return upcoming;
  } catch (error) {
    console.error('Error getting sophisticated upcoming emails:', error);
    return [];
  }
};

// Predict the theme for the next action based on user's journey
const predictNextActionTheme = (user) => {
  const week = user.current_week + 1;
  const goalText = user.goals.toLowerCase();
  
  // Week-based progression with goal customization
  const weekThemes = {
    1: 'Self-Discovery',
    2: 'Communication Foundation', 
    3: 'Relationship Building',
    4: 'Feedback Mastery',
    5: 'Influence Development',
    6: 'Team Effectiveness',
    7: 'Decision-Making',
    8: 'Strategic Thinking',
    9: 'Change Leadership',
    10: 'Advanced Influence',
    11: 'Leadership Legacy',
    12: 'Sustainable Excellence'
  };
  
  let baseTheme = weekThemes[week] || 'Leadership Growth';
  
  // Customize based on goals
  if (goalText.includes('communication') && week >= 2) {
    baseTheme = 'Communication Mastery';
  } else if (goalText.includes('team') && week >= 5) {
    baseTheme = 'Team Leadership Excellence';
  } else if (goalText.includes('strategic') && week >= 7) {
    baseTheme = 'Strategic Leadership';
  }
  
  return baseTheme;
};

// Get user engagement level from their email history
const getEngagementLevel = async (userId) => {
  try {
    const emailHistory = await getEmailHistory(userId, 10);
    return assessEngagementLevel(emailHistory);
  } catch (error) {
    console.error('Error getting engagement level:', error);
    return 'unknown';
  }
};

// Calculate when a user's next email should be sent
const calculateNextEmailTime = (user, currentTime) => {
  try {
    const userTime = getUserLocalTime(currentTime, user.timezone);
    
    // Find next Monday at 9 AM in user's timezone
    let nextMonday = new Date(userTime);
    
    // Get days until next Monday
    const daysUntilMonday = (8 - userTime.getDay()) % 7 || 7;
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    
    // Set to 9 AM
    nextMonday.setHours(9, 0, 0, 0);
    
    // If it's already Monday and past 9 AM, go to next Monday
    if (userTime.getDay() === 1 && userTime.getHours() >= 9) {
      nextMonday.setDate(nextMonday.getDate() + 7);
    }
    
    // Convert back to UTC for storage
    return new Date(nextMonday.toLocaleString("en-US", { timeZone: "UTC" }));
  } catch (error) {
    console.error(`Error calculating next email time for user timezone ${user.timezone}`);
    // Fallback to next Monday 9 AM UTC
    const nextMonday = new Date(currentTime);
    const daysUntilMonday = (8 - nextMonday.getDay()) % 7 || 7;
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    nextMonday.setHours(9, 0, 0, 0);
    return nextMonday;
  }
};

// Export all sophisticated functions
module.exports = {
  scheduleWeeklyEmails,
  processWeeklyEmails,
  sendManualEmail,
  testScheduling,
  getUpcomingEmails,
  sendWeeklyEmailToUser, // Export for direct use if needed
  assessEngagementLevel,
  assessGoalComplexity,
  extractActionTheme
};const cron = require('node-cron');
const { getActiveUsers, updateUserWeek, getEmailHistory } = require('./database');
const { generateWeeklyEmail } = require('./aiService');
const { sendEmail } = require('./emailService');

// Schedule weekly emails for Monday at 9 AM in each user's timezone
// This runs every hour to check for users who need emails
const scheduleWeeklyEmails = () => {
  // Run every hour on the hour
  cron.schedule('0 * * * *', async () => {
    console.log('Checking for users who need weekly emails...');
    await processWeeklyEmails();
  }, {
    scheduled: true,
    timezone: "UTC"
  });
  
  console.log('Weekly email scheduler started - checking hourly for users needing emails');
};

// Main function to process weekly emails
const processWeeklyEmails = async () => {
  try {
    const users = await getActiveUsers();
    const now = new Date();
    
    for (const user of users) {
      try {
        if (await shouldSendWeeklyEmail(user, now)) {
          await sendWeeklyEmailToUser(user);
        }
      } catch (error) {
        console.error(`Error processing email for user ${user.id}:`, error);
        // Continue with other users even if one fails
      }
    }
  } catch (error) {
    console.error('Error in processWeeklyEmails:', error);
  }
};

// Determine if a user should receive their weekly email now
const shouldSendWeeklyEmail = async (user, currentTime) => {
  // Skip if user has completed 12 weeks
  if (user.current_week >= 12) {
    return false;
  }
  
  // Get user's current time
  const userTime = getUserLocalTime(currentTime, user.timezone);
  const dayOfWeek = userTime.getDay(); // 0 = Sunday, 1 = Monday
  const hour = userTime.getHours();
  
  // Only send on Mondays at 9 AM (with 1-hour window)
  if (dayOfWeek !== 1 || hour !== 9) {
    return false;
  }
  
  // Check if we already sent an email this week
  const lastEmailDate = user.last_email_sent ? new Date(user.last_email_sent) : null;
  if (lastEmailDate) {
    const daysSinceLastEmail = Math.floor((currentTime - lastEmailDate) / (1000 * 60 * 60 * 24));
    if (daysSinceLastEmail < 6) { // Wait at least 6 days between emails
      return false;
    }
  }
  
  return true;
};

// Get user's local time based on their timezone
const getUserLocalTime = (utcTime, timezone) => {
  try {
    return new Date(utcTime.toLocaleString("en-US", { timeZone: timezone }));
  } catch (error) {
    console.error(`Invalid timezone ${timezone}, using UTC`);
    return utcTime;
  }
};

// Send weekly email to a specific user
const sendWeeklyEmailToUser = async (user) => {
  try {
    console.log(`Sending weekly email to user ${user.id} (week ${user.current_week + 1})`);
    
    // Get user's email history for context
    const emailHistory = await getEmailHistory(user.id);
    const previousActions = emailHistory
      .filter(email => email.action_item)
      .map(email => email.action_item)
      .slice(-3); // Last 3 actions for context
    
    // Determine the previous week's action
    const lastAction = previousActions.length > 0 ? previousActions[previousActions.length - 1] : null;
    
    // Generate AI content for this week
    const aiContent = await generateWeeklyEmail({
      goals: user.goals,
      weekNumber: user.current_week + 1,
      previousAction: lastAction,
      previousActions: previousActions
    });
    
    // Create email content
    const emailData = {
      to: user.email,
      subject: `Week ${user.current_week + 1}: Keep the momentum going!`,
      weekNumber: user.current_week + 1,
      previousAction: lastAction,
      newAction: aiContent.actionItem,
      encouragement: aiContent.encouragement,
      goalConnection: aiContent.goalConnection,
      totalWeeks: 12
    };
    
    // Send the email
    const emailSent = await sendEmail(emailData, 'weekly');
    
    if (emailSent) {
      // Update user's progress
      await updateUserWeek(user.id, user.current_week + 1, aiContent.actionItem);
      console.log(`Successfully sent week ${user.current_week + 1} email to ${user.email}`);
    } else {
      console.error(`Failed to send email to ${user.email}`);
    }
    
  } catch (error) {
    console.error(`Error sending weekly email to user ${user.id}:`, error);
    throw error;
  }
};

// Manual function to send email to specific user (for admin use)
const sendManualEmail = async (userId) => {
  try {
    const users = await getActiveUsers();
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      throw new Error(`User ${userId} not found or not active`);
    }
    
    await sendWeeklyEmailToUser(user);
    return true;
  } catch (error) {
    console.error(`Error sending manual email to user ${userId}:`, error);
    throw error;
  }
};

// Test function to check scheduling logic
const testScheduling = async () => {
  console.log('Testing scheduling logic...');
  
  const testUsers = [
    {
      id: 1,
      email: 'test@example.com',
      timezone: 'America/New_York',
      current_week: 2,
      last_email_sent: '2025-06-16T13:00:00Z' // Last Monday
    },
    {
      id: 2,
      email: 'test2@example.com', 
      timezone: 'Europe/London',
      current_week: 0,
      last_email_sent: null
    }
  ];
  
  const now = new Date();
  
  for (const user of testUsers) {
    const shouldSend = await shouldSendWeeklyEmail(user, now);
    const userTime = getUserLocalTime(now, user.timezone);
    
    console.log(`User ${user.id}:`);
    console.log(`  Timezone: ${user.timezone}`);
    console.log(`  Local time: ${userTime.toLocaleString()}`);
    console.log(`  Should send email: ${shouldSend}`);
    console.log(`  Current week: ${user.current_week}`);
    console.log('---');
  }
};

// Function to get next scheduled email times for all users (for admin dashboard)
const getUpcomingEmails = async () => {
  try {
    const users = await getActiveUsers();
    const now = new Date();
    const upcoming = [];
    
    for (const user of users) {
      if (user.current_week < 12) {
        const nextEmailTime = calculateNextEmailTime(user, now);
        upcoming.push({
          userId: user.id,
          email: user.email,
          currentWeek: user.current_week,
          nextEmailTime: nextEmailTime,
          timezone: user.timezone
        });
      }
    }
    
    // Sort by next email time
    upcoming.sort((a, b) => new Date(a.nextEmailTime) - new Date(b.nextEmailTime));
    
    return upcoming;
  } catch (error) {
    console.error('Error getting upcoming emails:', error);
    return [];
  }
};

// Calculate when a user's next email should be sent
const calculateNextEmailTime = (user, currentTime) => {
  try {
    const userTime = getUserLocalTime(currentTime, user.timezone);
    
    // Find next Monday at 9 AM in user's timezone
    let nextMonday = new Date(userTime);
    
    // Get days until next Monday
    const daysUntilMonday = (8 - userTime.getDay()) % 7 || 7;
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    
    // Set to 9 AM
    nextMonday.setHours(9, 0, 0, 0);
    
    // If it's already Monday and past 9 AM, go to next Monday
    if (userTime.getDay() === 1 && userTime.getHours() >= 9) {
      nextMonday.setDate(nextMonday.getDate() + 7);
    }
    
    // Convert back to UTC for storage
    return new Date(nextMonday.toLocaleString("en-US", { timeZone: "UTC" }));
  } catch (error) {
    console.error(`Error calculating next email time for user timezone ${user.timezone}`);
    // Fallback to next Monday 9 AM UTC
    const nextMonday = new Date(currentTime);
    const daysUntilMonday = (8 - nextMonday.getDay()) % 7 || 7;
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    nextMonday.setHours(9, 0, 0, 0);
    return nextMonday;
  }
};

// Export all functions
module.exports = {
  scheduleWeeklyEmails,
  processWeeklyEmails,
  sendManualEmail,
  testScheduling,
  getUpcomingEmails
};