// Enhanced weekly email sending with sophisticated AI integration
const sendEmail = async (emailData, templateType = 'weekly') => {
  let transporter;
  
  try {
    // Input validation with enhanced checks
    if (!emailData || !emailData.to || !emailData.newAction) {
      throw new Error('Invalid email data provided');
    }

    // Validate email content sophistication
    if (emailData.newAction.length < 100) {
      console.warn('Action item may be too brief for sophisticated coaching');
    }

    transporter = createTransporter();
    const template = await loadTemplate(templateType);
    
    // Calculate progress percentage
    const progressPercent = Math.round((emailData.weekNumber / (emailData.totalWeeks || 12)) * 100);
    
    // Enhanced template data with sophisticated elements
    const templateData = {
      WEEK_NUMBER: emailData.weekNumber || 1,
      TOTAL_WEEKS: emailData.totalWeeks || 12,
      PROGRESS_PERCENT: progressPercent,
      PREVIOUS_ACTION: emailData.previousAction,
      ENCOURAGEMENT: emailData.encouragement || 'Excellent progress',
      NEW_ACTION: emailData.newAction,
      GOAL_CONNECTION: emailData.goalConnection || 'This builds on your leadership development journey.',
      USER_GOALS: emailData.userGoals || '',
      // Enhanced sophistication indicators
      ACTION_COMPLEXITY: assessActionComplexity(emailData.newAction),
      PERSONALIZATION_LEVEL: assessPersonalizationLevel(emailData),
      COACHING_DEPTH: assessCoachingDepth(emailData.goalConnection)
    };
    
    const htmlContent = processTemplate(template, templateData);
    
    // Enhanced mail options with sophisticated metadata
    const mailOptions = {
      from: {
        name: 'Dr. Sarah Chen - Go Leadership Coach',
        address: process.env.EMAIL_USER || 'coach@go-leadership.app'
      },
      to: emailData.to,
      subject: emailData.subject || `Week ${emailData.weekNumber}: Your leadership evolution continues`,
      html: htmlContent,
      text: generateSophisticatedTextVersion(templateData),
      headers: {
        'List-Unsubscribe': `<mailto:unsubscribe@go-leadership.app?subject=Unsubscribe>`,
        'X-Leadership-Week': emailData.weekNumber.toString(),
        'X-Coaching-Level': templateData.ACTION_COMPLEXITY,
        'X-Personalization': templateData.PERSONALIZATION_LEVEL
      },
      messageId: `leadership-${emailData.weekNumber}-${Date.now()}@go-leadership.app`,
      // Enhanced tracking for sophisticated coaching
      envelope: {
        from: process.env.EMAIL_USER,
        to: emailData.to
      }
    };
    
    const result = await sendEmailWithRetry(transporter, mailOptions);
    
    // Log sophisticated delivery metrics
    if (result.success) {
      console.log(`✅ Sophisticated coaching email delivered:`, {
        week: emailData.weekNumber,
        recipient: emailData.to,
        actionComplexity: templateData.ACTION_COMPLEXITY,
        personalizationLevel: templateData.PERSONALIZATION_LEVEL,
        messageId: result.messageId
      });
    }
    
    return result.success;
    
  } catch (error) {
    console.error('Error sending sophisticated weekly email:', error);
    return false;
  } finally {
    if (transporter && transporter.close) {
      transporter.close();
    }
  }
};

// Assess the sophistication level of AI-generated actions
const assessActionComplexity = (actionItem) => {
  const text = actionItem.toLowerCase();
  let complexityScore = 0;
  
  // Psychological sophistication indicators
  const psychologyWords = ['reflect', 'analyze', 'observe', 'assess', 'evaluate', 'examine'];
  const strategyWords = ['design', 'create', 'develop', 'implement', 'framework', 'approach'];
  const interpersonalWords = ['conversation', 'relationship', 'influence', 'feedback', 'collaboration'];
  const systemsWords = ['process', 'system', 'culture', 'environment', 'dynamics'];
  
  psychologyWords.forEach(word => { if (text.includes(word)) complexityScore += 2; });
  strategyWords.forEach(word => { if (text.includes(word)) complexityScore += 2; });
  interpersonalWords.forEach(word => { if (text.includes(word)) complexityScore += 1; });
  systemsWords.forEach(word => { if (text.includes(word)) complexityScore += 1; });
  
  // Length and specificity indicators
  if (actionItem.length > 200) complexityScore += 2;
  if (text.includes('specific') || text.includes('detailed')) complexityScore += 1;
  if (text.includes('30 minutes') || text.includes('one week')) complexityScore += 1;
  
  if (complexityScore >= 8) return 'sophisticated';
  if (complexityScore >= 5) return 'intermediate';
  if (complexityScore >= 2) return 'foundational';
  return 'basic';
};

// Assess personalization level of the coaching content
const assessPersonalizationLevel = (emailData) => {
  let personalizationScore = 0;
  
  // Check for specific goal references
  if (emailData.goalConnection && emailData.goalConnection.length > 50) {
    personalizationScore += 2;
  }
  
  // Check for previous action integration
  if (emailData.previousAction && emailData.encouragement) {
    personalizationScore += 2;
  }
  
  // Check for sophisticated encouragement
  const encouragement = emailData.encouragement || '';
  if (encouragement.length > 10 && !encouragement.includes('great job')) {
    personalizationScore += 1;
  }
  
  // Check for goal-specific language in action
  if (emailData.newAction && emailData.userGoals) {
    const actionWords = emailData.newAction.toLowerCase().split(' ');
    const goalWords = emailData.userGoals.toLowerCase().split(' ');
    const overlap = actionWords.filter(word => goalWords.includes(word) && word.length > 4);
    if (overlap.length >= 2) personalizationScore += 2;
  }
  
  if (personalizationScore >= 6) return 'highly_personalized';
  if (personalizationScore >= 4) return 'personalized';
  if (personalizationScore >= 2) return 'somewhat_personalized';
  return 'generic';
};

// Assess the coaching depth of goal connections
const assessCoachingDepth = (goalConnection) => {
  if (!goalConnection) return 'shallow';
  
  const text = goalConnection.toLowerCase();
  let depthScore = 0;
  
  // Sophisticated coaching language indicators
  const deepWords = [
    'transformation', 'development', 'growth', 'mastery', 'excellence',
    'foundation', 'capability', 'competence', 'effectiveness', 'impact'
  ];
  
  const psychologicalWords = [
    'awareness', 'understanding', 'insight', 'perspective', 'mindset',
    'confidence', 'resilience', 'presence', 'influence'
  ];
  
  deepWords.forEach(word => { if (text.includes(word)) depthScore += 1; });
  psychologicalWords.forEach(word => { if (text.includes(word)) depthScore += 2; });
  
  // Check for future-oriented language
  if (text.includes('long-term') || text.includes('sustained') || text.includes('continue')) {
    depthScore += 1;
  }
  
  // Check for process language
  if (text.includes('builds') || text.includes('develops') || text.includes('strengthens')) {
    depthScore += 1;
  }
  
  if (depthScore >= 5) return 'profound';
  if (depthScore >= 3) return 'thoughtful';
  if (depthScore >= 1) return 'meaningful';
  return 'surface';
};

// Generate sophisticated plain text version
const generateSophisticatedTextVersion = (data) => {
  let text = `Week ${data.WEEK_NUMBER} - Leadership Development with Dr. Sarah Chen\n`;
  text += `Progress: ${data.PROGRESS_PERCENT}% Complete (${data.WEEK_NUMBER} of ${data.TOTAL_WEEKS} weeks)\n\n`;
  
  if (data.PREVIOUS_ACTION) {
    text += `Reflecting on Last Week:\n`;
    text += `Your focus: ${data.PREVIOUS_ACTION}\n`;
    text += `Assessment: ${data.ENCOURAGEMENT} - I can see the intentional growth in your approach.\n\n`;
  }
  
  text += `This Week's Leadership Development:\n`;
  text += `${data.NEW_ACTION}\n\n`;
  
  text += `Connection to Your Leadership Vision:\n`;
  text += `${data.GOAL_CONNECTION}\n\n`;
  
  text += `Development Notes:\n`;
  text += `• Action Sophistication Level: ${data.ACTION_COMPLEXITY}\n`;
  text += `• Personalization Depth: ${data.PERSONALIZATION_LEVEL}\n`;
  text += `• Coaching Integration: ${data.COACHING_DEPTH}\n\n`;
  
  text += `Your leadership transformation is progressing beautifully. Each week builds on the last, creating compound growth that will serve you for years to come.\n\n`;
  
  text += `With continued belief in your potential,\n`;
  text += `Dr. Sarah Chen\n`;
  text += `Executive Leadership Coach\n\n`;
  
  text += `---\n`;
  text += `This is week ${data.WEEK_NUMBER} of your 12-week executive leadership development program.\n`;
  text += `For support or questions, simply reply to this email.\n`;
  text += `To unsubscribe: reply with "UNSUBSCRIBE"`;
  
  return text;
};

// Enhanced welcome email with sophisticated AI integration
const sendWelcomeEmail = async (userData, aiContent) => {
  let transporter;
  
  try {
    // Enhanced input validation
    if (!userData || !userData.email || !userData.goals) {
      throw new Error('Invalid user data provided');
    }

    if (!aiContent || !aiContent.feedback || !aiContent.firstAction) {
      throw new Error('Invalid AI content provided');
    }

    // Assess the sophistication of the AI-generated content
    const feedbackDepth = assessCoachingDepth(aiContent.feedback);
    const actionComplexity = assessActionComplexity(aiContent.firstAction);
    
    console.log(`Sending sophisticated welcome email to ${userData.email}:`, {
      feedbackDepth,
      actionComplexity,
      goalLength: userData.goals.length
    });

    transporter = createTransporter();
    const template = await loadTemplate('welcome');
    
    const emailData = {
      USER_GOALS: userData.goals,
      AI_FEEDBACK: aiContent.feedback,
      FIRST_ACTION: aiContent.firstAction,
      COACHING_DEPTH: feedbackDepth,
      ACTION_COMPLEXITY: actionComplexity
    };
    
    const htmlContent = processTemplate(template, emailData);
    
    // Enhanced welcome email options
    const mailOptions = {
      from: {
        name: 'Dr. Sarah Chen - Go Leadership Coach',
        address: process.env.EMAIL_USER || 'coach@go-leadership.app'
      },
      to: userData.email,
      subject: 'Welcome to your executive leadership transformation 🌟',
      html: htmlContent,
      text: generateSophisticatedWelcomeText({
        goals: userData.goals,
        feedback: aiContent.feedback,
        action: aiContent.firstAction
      }),
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high',
        'List-Unsubscribe': `<mailto:unsubscribe@go-leadership.app?subject=Unsubscribe>`,
        'X-Coaching-Depth': feedbackDepth,
        'X-Action-Complexity': actionComplexity
      },
      envelope: {
        from: process.env.EMAIL_USER,
        to: userData.email
      },
      messageId: `welcome-sophisticated-${userData.id}-${Date.now()}@go-leadership.app`
    };
    
    const result = await sendEmailWithRetry(transporter, mailOptions);
    
    if (result.success) {
      // Log sophisticated welcome email delivery
      try {
        await logEmailHistory(
          userData.id, 
          0, 
          aiContent.firstAction, 
          mailOptions.subject, 
          `Sophisticated welcome email: ${feedbackDepth} coaching depth, ${actionComplexity} action complexity`
        );
        
        console.log(`✅ Sophisticated welcome email delivered to ${userData.email}:`, {
          messageId: result.messageId,
          feedbackDepth,
          actionComplexity
        });
      } catch (logError) {
        console.error('Failed to log sophisticated welcome email:', logError);
      }
    }
    
    return result;
    
  } catch (error) {
    console.error('Error sending sophisticated welcome email:', error);
    
    // Update email status if we have user ID
    if (userData && userData.id) {
      try {
        await updateEmailStatus(userData.id, 0, 'failed');
      } catch (statusError) {
        console.error('Failed to update email status:', statusError);
      }
    }
    
    return { success: false, error: error.message };
  } finally {
    if (transporter && transporter.close) {
      transporter.close();
    }
  }
};

// Generate sophisticated welcome text version
const generateSophisticatedWelcomeText = (data) => {
  return `Welcome to Your Executive Leadership Transformation

Dear Future Leader,

Thank you for entrusting me with your leadership development journey. I've carefully reviewed your goals:

"${data.goals}"

My Initial Assessment:
${data.feedback}

Your First Strategic Action:
${data.action}

What Makes This Program Different:
• Psychologically-informed coaching based on 20+ years of executive development
• AI-enhanced personalization that adapts to your unique leadership style
• Progressive skill building that creates lasting behavioral change
• Weekly actions designed for busy executives (30-60 minutes each)

Over the next 12 weeks, you'll receive personalized coaching every Monday at 9 AM that builds systematically on your previous growth. Each week is designed to create compound leadership development that will serve you for years to come.

I'm honored to be part of your transformation.

With belief in your leadership potential,

Dr. Sarah Chen
Executiveconst nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const { logEmailHistory, updateEmailStatus } = require('./database');

// Enhanced transporter configuration with security
const createTransporter = () => {
  try {
    const config = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false, // Use TLS
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      // Enhanced security options
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false // For development; set to true in production
      },
      // Connection pooling for better performance
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateLimit: 10, // Max 10 emails per second
      // Enhanced timeouts
      connectionTimeout: 30000, // 30 seconds
      greetingTimeout: 30000,
      socketTimeout: 60000
    };

    // Additional security for production
    if (process.env.NODE_ENV === 'production') {
      config.tls.rejectUnauthorized = true;
      config.secure = process.env.SMTP_PORT === '465'; // Use SSL for port 465
    }

    const transporter = nodemailer.createTransporter(config);

    // Add event listeners for monitoring
    transporter.on('error', (error) => {
      console.error('Transporter error:', error);
    });

    transporter.on('log', (info) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Transporter log:', info);
      }
    });

    return transporter;
  } catch (error) {
    console.error('Failed to create email transporter:', error);
    throw error;
  }
};

// Enhanced template loading with caching
const templateCache = new Map();

const loadTemplate = async (templateName) => {
  try {
    // Check cache first
    if (templateCache.has(templateName)) {
      return templateCache.get(templateName);
    }

    const templatePath = path.join(__dirname, 'templates', `${templateName}.html`);
    
    let template;
    try {
      template = await fs.readFile(templatePath, 'utf8');
    } catch (fileError) {
      console.warn(`Template file not found: ${templatePath}, using default`);
      template = getDefaultTemplate(templateName);
    }

    // Cache the template
    templateCache.set(templateName, template);
    return template;
  } catch (error) {
    console.error(`Error loading template ${templateName}:`, error);
    return getDefaultTemplate(templateName);
  }
};

// Enhanced default templates with better security
const getDefaultTemplate = (templateName) => {
  const templates = {
    welcome: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-Content-Type-Options" content="nosniff">
    <meta http-equiv="X-Frame-Options" content="DENY">
    <title>Welcome to Go!</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6; 
            color: #1a1a1a; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 0; 
            background: #f5f4f0; 
        }
        .container { 
            background: white; 
            margin: 40px 20px; 
            border-radius: 0; 
            overflow: hidden; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
        }
        .header { 
            background: #1a1a1a; 
            color: white; 
            padding: 40px; 
            text-align: center; 
        }
        .header h1 { 
            margin: 0; 
            font-size: 2.5rem; 
            font-weight: 700; 
            letter-spacing: 2px; 
        }
        .content { 
            padding: 50px 40px; 
        }
        .goals-section { 
            background: #f5f4f0; 
            padding: 30px; 
            margin: 30px 0; 
            border-left: 4px solid #1a1a1a; 
        }
        .action-box { 
            background: #1a1a1a; 
            color: white; 
            padding: 40px; 
            margin: 40px 0; 
            text-align: center; 
        }
        .footer { 
            background: #f5f4f0; 
            padding: 30px 40px; 
            text-align: center; 
            color: #666; 
            font-size: 14px; 
        }
        @media (max-width: 600px) {
            .container { margin: 20px 10px; }
            .header, .content, .footer { padding: 30px 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>GO</h1>
            <p>Your 12-week leadership journey starts now</p>
        </div>
        <div class="content">
            <p>Hi there!</p>
            <p>Welcome to your personalized leadership development journey!</p>
            <div class="goals-section">
                <h3>Your Leadership Goals</h3>
                <div style="font-style: italic; margin: 20px 0;">{{USER_GOALS}}</div>
                <div>{{AI_FEEDBACK}}</div>
            </div>
            <div class="action-box">
                <h3>🎯 Your First Action Item</h3>
                <div style="font-size: 1.1rem; line-height: 1.6;">{{FIRST_ACTION}}</div>
            </div>
            <p>Best regards,<br><strong>Your Go Coach</strong></p>
        </div>
        <div class="footer">
            <p>This is the beginning of your 12-week Go leadership program.</p>
        </div>
    </div>
</body>
</html>`,

    weekly: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-Content-Type-Options" content="nosniff">
    <meta http-equiv="X-Frame-Options" content="DENY">
    <title>Week {{WEEK_NUMBER}} - Go Leadership</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6; 
            color: #1a1a1a; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 0; 
            background: #f5f4f0; 
        }
        .container { 
            background: white; 
            margin: 40px 20px; 
            overflow: hidden; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
        }
        .header { 
            background: #1a1a1a; 
            color: white; 
            padding: 40px; 
            text-align: center; 
        }
        .progress-bar { 
            background: rgba(255,255,255,0.2); 
            height: 8px; 
            border-radius: 4px; 
            margin: 20px 0; 
        }
        .progress-fill { 
            background: white; 
            height: 100%; 
            border-radius: 4px; 
        }
        .content { 
            padding: 50px 40px; 
        }
        .action-box { 
            background: #1a1a1a; 
            color: white; 
            padding: 40px; 
            margin: 40px 0; 
            text-align: center; 
        }
        .footer { 
            background: #f5f4f0; 
            padding: 30px 40px; 
            text-align: center; 
            color: #666; 
            font-size: 14px; 
        }
        @media (max-width: 600px) {
            .container { margin: 20px 10px; }
            .header, .content, .footer { padding: 30px 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Week {{WEEK_NUMBER}}</h1>
            <div class="progress-bar">
                <div class="progress-fill" style="width: {{PROGRESS_PERCENT}}%"></div>
            </div>
            <p>Week {{WEEK_NUMBER}} of {{TOTAL_WEEKS}} • {{PROGRESS_PERCENT}}% Complete</p>
        </div>
        <div class="content">
            <p>Hi there!</p>
            {{#if PREVIOUS_ACTION}}
            <div style="background: #e8f5e8; padding: 20px; margin: 20px 0;">
                <strong>Last week:</strong> {{PREVIOUS_ACTION}}<br>
                <em>{{ENCOURAGEMENT}} on taking that step!</em>
            </div>
            {{/if}}
            <div class="action-box">
                <h3>🎯 This Week's Action</h3>
                <div style="font-size: 1.1rem; line-height: 1.6;">{{NEW_ACTION}}</div>
            </div>
            <p>{{GOAL_CONNECTION}}</p>
            <p>Best regards,<br><strong>Your Go Coach</strong></p>
        </div>
        <div class="footer">
            <p>This is week {{WEEK_NUMBER}} of your 12-week Go leadership program.</p>
        </div>
    </div>
</body>
</html>`
  };
  
  return templates[templateName] || templates.welcome;
};

// Enhanced template processing with XSS protection
const processTemplate = (template, data) => {
  let processed = template;
  
  // Sanitize data to prevent XSS
  const sanitizedData = {};
  Object.keys(data).forEach(key => {
    const value = data[key];
    if (typeof value === 'string') {
      // Basic HTML escape for security
      sanitizedData[key] = value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    } else {
      sanitizedData[key] = value;
    }
  });
  
  // Simple template variable replacement
  Object.keys(sanitizedData).forEach(key => {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    processed = processed.replace(placeholder, sanitizedData[key] || '');
  });
  
  // Handle conditional blocks (simple if statements)
  processed = processed.replace(/{{#if\s+([^}]+)}}([\s\S]*?){{\/if}}/g, (match, condition, content) => {
    return sanitizedData[condition] ? content : '';
  });
  
  return processed;
};

// Enhanced welcome email with comprehensive error handling
const sendWelcomeEmail = async (userData, aiContent) => {
  let transporter;
  
  try {
    // Input validation
    if (!userData || !userData.email || !userData.goals) {
      throw new Error('Invalid user data provided');
    }

    if (!aiContent || !aiContent.feedback || !aiContent.firstAction) {
      throw new Error('Invalid AI content provided');
    }

    transporter = createTransporter();
    const template = await loadTemplate('welcome');
    
    const emailData = {
      USER_GOALS: userData.goals,
      AI_FEEDBACK: aiContent.feedback,
      FIRST_ACTION: aiContent.firstAction
    };
    
    const htmlContent = processTemplate(template, emailData);
    
    // Enhanced mail options with security headers
    const mailOptions = {
      from: {
        name: 'Go Leadership Coach',
        address: process.env.EMAIL_USER || 'coach@go-leadership.app'
      },
      to: userData.email,
      subject: 'Welcome to Go! Your leadership journey starts now 🚀',
      html: htmlContent,
      text: generateTextVersion({
        goals: userData.goals,
        feedback: aiContent.feedback,
        action: aiContent.firstAction
      }),
      // Security and tracking headers
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high',
        'List-Unsubscribe': `<mailto:unsubscribe@go-leadership.app?subject=Unsubscribe>`,
      },
      // Enhanced options
      envelope: {
        from: process.env.EMAIL_USER,
        to: userData.email
      },
      messageId: `welcome-${userData.id}-${Date.now()}@go-leadership.app`
    };
    
    const result = await sendEmailWithRetry(transporter, mailOptions);
    
    if (result.success) {
      // Log the welcome email
      try {
        await logEmailHistory(
          userData.id, 
          0, 
          aiContent.firstAction, 
          mailOptions.subject, 
          'Welcome email sent successfully'
        );
      } catch (logError) {
        console.error('Failed to log welcome email:', logError);
        // Don't fail the entire operation for logging errors
      }
    }
    
    return result;
    
  } catch (error) {
    console.error('Error sending welcome email:', error);
    
    // Update email status if we have user ID
    if (userData && userData.id) {
      try {
        await updateEmailStatus(userData.id, 0, 'failed');
      } catch (statusError) {
        console.error('Failed to update email status:', statusError);
      }
    }
    
    return { success: false, error: error.message };
  } finally {
    if (transporter && transporter.close) {
      transporter.close();
    }
  }
};

// Enhanced weekly email sending
const sendEmail = async (emailData, templateType = 'weekly') => {
  let transporter;
  
  try {
    // Input validation
    if (!emailData || !emailData.to || !emailData.newAction) {
      throw new Error('Invalid email data provided');
    }

    transporter = createTransporter();
    const template = await loadTemplate(templateType);
    
    // Calculate progress percentage
    const progressPercent = Math.round((emailData.weekNumber / (emailData.totalWeeks || 12)) * 100);
    
    const templateData = {
      WEEK_NUMBER: emailData.weekNumber || 1,
      TOTAL_WEEKS: emailData.totalWeeks || 12,
      PROGRESS_PERCENT: progressPercent,
      PREVIOUS_ACTION: emailData.previousAction,
      ENCOURAGEMENT: emailData.encouragement || 'Great work',
      NEW_ACTION: emailData.newAction,
      GOAL_CONNECTION: emailData.goalConnection || 'This builds on your leadership development.',
      USER_GOALS: emailData.userGoals || ''
    };
    
    const htmlContent = processTemplate(template, templateData);
    
    const mailOptions = {
      from: {
        name: 'Go Leadership Coach',
        address: process.env.EMAIL_USER || 'coach@go-leadership.app'
      },
      to: emailData.to,
      subject: emailData.subject || `Week ${emailData.weekNumber}: Keep the momentum going!`,
      html: htmlContent,
      text: generateTextVersion(templateData),
      headers: {
        'List-Unsubscribe': `<mailto:unsubscribe@go-leadership.app?subject=Unsubscribe>`,
      },
      messageId: `weekly-${emailData.weekNumber}-${Date.now()}@go-leadership.app`
    };
    
    const result = await sendEmailWithRetry(transporter, mailOptions);
    return result.success;
    
  } catch (error) {
    console.error('Error sending weekly email:', error);
    return false;
  } finally {
    if (transporter && transporter.close) {
      transporter.close();
    }
  }
};

// Enhanced text version generation
const generateTextVersion = (data) => {
  if (data.goals && data.feedback && data.action) {
    // Welcome email text version
    return `Welcome to Go Leadership!

Your goals: ${data.goals}

${data.feedback}

Your first action item: ${data.action}

Looking forward to supporting you over the next 12 weeks!

Best regards,
Your Go Coach

---
This is the beginning of your 12-week Go leadership program.
To unsubscribe, reply with "UNSUBSCRIBE"`;
  } else {
    // Weekly email text version
    let text = `Week ${data.WEEK_NUMBER} - Go Leadership Program\n\n`;
    
    if (data.PREVIOUS_ACTION) {
      text += `Last week's focus: ${data.PREVIOUS_ACTION}\n`;
      text += `${data.ENCOURAGEMENT} on taking that step!\n\n`;
    }
    
    text += `This week's action:\n${data.NEW_ACTION}\n\n`;
    text += `${data.GOAL_CONNECTION}\n\n`;
    text += `You're ${data.WEEK_NUMBER} weeks into your leadership journey. Keep up the excellent work!\n\n`;
    text += `Best regards,\nYour Go Coach\n\n`;
    text += `---\nThis is week ${data.WEEK_NUMBER} of your 12-week Go leadership program.\n`;
    text += `To unsubscribe, reply with "UNSUBSCRIBE"`;
    
    return text;
  }
};

// Enhanced email sending with comprehensive retry logic
const sendEmailWithRetry = async (transporter, mailOptions, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Sending email to ${mailOptions.to} (attempt ${attempt}/${maxRetries})`);
      
      // Verify transporter before sending
      if (attempt === 1) {
        try {
          await transporter.verify();
        } catch (verifyError) {
          console.error('Transporter verification failed:', verifyError);
          if (attempt === maxRetries) {
            throw new Error(`Email service not available: ${verifyError.message}`);
          }
          continue;
        }
      }
      
      const info = await transporter.sendMail(mailOptions);
      
      console.log(`Email sent successfully: ${info.messageId} to ${mailOptions.to}`);
      return { 
        success: true, 
        messageId: info.messageId,
        attempt: attempt,
        response: info.response
      };
      
    } catch (error) {
      console.error(`Email send attempt ${attempt} failed:`, {
        error: error.message,
        code: error.code,
        command: error.command,
        to: mailOptions.to
      });
      
      // Determine if error is retryable
      const retryableErrors = [
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ECONNREFUSED',
        'NETWORK_ERROR'
      ];
      
      const isRetryable = retryableErrors.some(code => 
        error.code === code || error.message.includes(code)
      );
      
      if (attempt === maxRetries || !isRetryable) {
        return { 
          success: false, 
          error: error.message,
          code: error.code,
          attempts: attempt,
          retryable: isRetryable
        };
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.log(`Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Enhanced email testing
const testEmail = async (testEmail = 'test@example.com') => {
  console.log('Testing email service...');
  
  try {
    // Input validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      throw new Error('Invalid test email format');
    }

    const testData = {
      to: testEmail,
      subject: 'Test Email from Go Leadership App',
      weekNumber: 1,
      totalWeeks: 12,
      previousAction: null,
      encouragement: 'Great start',
      newAction: 'Take 15 minutes to reflect on your leadership style and write down three strengths you bring to your role.',
      goalConnection: 'This self-reflection will help you build awareness of your current leadership foundation.'
    };
    
    const result = await sendEmail(testData, 'weekly');
    
    if (result) {
      console.log('✅ Test email sent successfully');
      return true;
    } else {
      console.log('❌ Test email failed');
      return false;
    }
    
  } catch (error) {
    console.error('Email test failed:', error);
    return false;
  }
};

// Enhanced email configuration verification
const verifyEmailConfig = async () => {
  try {
    // Check required environment variables
    const requiredVars = ['EMAIL_USER', 'EMAIL_PASSWORD'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error(`Missing email configuration: ${missingVars.join(', ')}`);
      return false;
    }

    const transporter = createTransporter();
    
    // Test connection with timeout
    const verifyPromise = transporter.verify();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Verification timeout')), 15000)
    );
    
    await Promise.race([verifyPromise, timeoutPromise]);
    
    console.log('✅ Email configuration verified successfully');
    
    // Close the transporter
    if (transporter.close) {
      transporter.close();
    }
    
    return true;
  } catch (error) {
    console.error('❌ Email configuration verification failed:', error.message);
    return false;
  }
};

// Enhanced bulk email sending with rate limiting
const sendBulkEmails = async (emailList, concurrencyLimit = 3) => {
  const results = [];
  const chunks = [];
  
  // Split emails into chunks for rate limiting
  for (let i = 0; i < emailList.length; i += concurrencyLimit) {
    chunks.push(emailList.slice(i, i + concurrencyLimit));
  }
  
  for (const chunk of chunks) {
    const chunkPromises = chunk.map(async (emailData) => {
      try {
        const result = await sendEmail(emailData);
        return {
          email: emailData.to,
          success: result,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return {
          email: emailData.to,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    });
    
    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
    
    // Rate limiting delay between chunks
    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
};

// Clear template cache (useful for development)
const clearTemplateCache = () => {
  templateCache.clear();
  console.log('Email template cache cleared');
};

// Email health check
const emailHealthCheck = async () => {
  try {
    const isConfigValid = await verifyEmailConfig();
    return {
      status: isConfigValid ? 'healthy' : 'unhealthy',
      configured: !!process.env.EMAIL_USER && !!process.env.EMAIL_PASSWORD,
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// Export all functions
module.exports = {
  sendWelcomeEmail,
  sendEmail,
  testEmail,
  verifyEmailConfig,
  sendBulkEmails,
  loadTemplate,
  processTemplate,
  clearTemplateCache,
  emailHealthCheck
}; const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const { logEmailHistory, updateEmailStatus } = require('./database');

// Configure email transporter (using Replit's email service)
const createTransporter = () => {
  // For Replit, we'll use their built-in email service
  // In production, you might use SendGrid, AWS SES, or similar
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER || 'your-go-app@gmail.com',
      pass: process.env.EMAIL_PASSWORD || process.env.REPLIT_EMAIL_KEY
    }
  });
};

// Load and process email templates
const loadTemplate = async (templateName) => {
  try {
    const templatePath = path.join(__dirname, 'templates', `${templateName}.html`);
    const template = await fs.readFile(templatePath, 'utf8');
    return template;
  } catch (error) {
    console.error(`Error loading template ${templateName}:`, error);
    return getDefaultTemplate(templateName);
  }
};

// Default templates if files don't exist
const getDefaultTemplate = (templateName) => {
  const templates = {
    welcome: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Go!</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .action-box { background: #e8f4fd; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
        .cta-button { background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Welcome to Go! 🚀</h1>
        <p>Your 12-week leadership journey starts now</p>
    </div>
    
    <div class="content">
        <p>Hi there!</p>
        
        <p>Welcome to your personalized leadership development journey! I've reviewed your goals:</p>
        
        <blockquote style="font-style: italic; border-left: 3px solid #667eea; padding-left: 15px; margin: 20px 0;">
            "{{USER_GOALS}}"
        </blockquote>
        
        <p>{{AI_FEEDBACK}}</p>
        
        <div class="action-box">
            <h3>🎯 Your First Action Item</h3>
            <p><strong>{{FIRST_ACTION}}</strong></p>
        </div>
        
        <p>Over the next 12 weeks, you'll receive a personalized email every Monday at 9 AM with a new action item designed to build your leadership skills progressively.</p>
        
        <p>I'm excited to support you on this journey!</p>
        
        <p>Best regards,<br>
        Your Go Coach</p>
    </div>
    
    <div class="footer">
        <p>This is week 0 of your 12-week Go leadership program.</p>
    </div>
</body>
</html>`,

    weekly: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Week {{WEEK_NUMBER}} - Go Leadership</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .progress-bar { background: #e0e0e0; height: 10px; border-radius: 5px; margin: 20px 0; }
        .progress-fill { background: #667eea; height: 100%; border-radius: 5px; transition: width 0.3s ease; }
        .action-box { background: #e8f4fd; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; }
        .reflection-box { background: #f0f8e8; border-left: 4px solid #4caf50; padding: 15px; margin: 15px 0; }
        .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Week {{WEEK_NUMBER}} 📈</h1>
        <p>Keep building your leadership skills</p>
        
        <div class="progress-bar">
            <div class="progress-fill" style="width: {{PROGRESS_PERCENT}}%"></div>
        </div>
        <p style="font-size: 14px; margin: 10px 0 0 0;">{{WEEK_NUMBER}} of {{TOTAL_WEEKS}} weeks complete</p>
    </div>
    
    <div class="content">
        <p>Hi there!</p>
        
        {{#if PREVIOUS_ACTION}}
        <div class="reflection-box">
            <p><strong>Last week's focus:</strong> {{PREVIOUS_ACTION}}</p>
            <p>{{ENCOURAGEMENT}} on taking that step!</p>
        </div>
        {{/if}}
        
        <p>This week, let's build on that momentum:</p>
        
        <div class="action-box">
            <h3>🎯 This Week's Action</h3>
            <p><strong>{{NEW_ACTION}}</strong></p>
        </div>
        
        <p>{{GOAL_CONNECTION}}</p>
        
        <p>You're {{WEEK_NUMBER}} weeks into your leadership journey. Every action you take is building the leader you're becoming!</p>
        
        <p>Keep up the excellent work!</p>
        
        <p>Best regards,<br>
        Your Go Coach</p>
    </div>
    
    <div class="footer">
        <p>This is week {{WEEK_NUMBER}} of your 12-week Go leadership program.</p>
        <p style="margin-top: 10px; font-size: 12px;">
            Having trouble with an action item? Simply reply to this email - I'm here to help!
        </p>
    </div>
</body>
</html>`
  };
  
  return templates[templateName] || templates.welcome;
};

// Replace template variables with actual data
const processTemplate = (template, data) => {
  let processed = template;
  
  // Simple template variable replacement
  Object.keys(data).forEach(key => {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    processed = processed.replace(placeholder, data[key] || '');
  });
  
  // Handle conditional blocks (simple if statements)
  processed = processed.replace(/{{#if\s+([^}]+)}}([\s\S]*?){{\/if}}/g, (match, condition, content) => {
    return data[condition] ? content : '';
  });
  
  return processed;
};

// Send welcome email
const sendWelcomeEmail = async (userData, aiContent) => {
  try {
    const template = await loadTemplate('welcome');
    
    const emailData = {
      USER_GOALS: userData.goals,
      AI_FEEDBACK: aiContent.feedback,
      FIRST_ACTION: aiContent.firstAction
    };
    
    const htmlContent = processTemplate(template, emailData);
    
    const mailOptions = {
      from: `"Go Leadership Coach" <${process.env.EMAIL_USER || 'coach@go-leadership.app'}>`,
      to: userData.email,
      subject: 'Welcome to Go! Your leadership journey starts now 🚀',
      html: htmlContent,
      text: `Welcome to Go!
      
Your goals: ${userData.goals}

${aiContent.feedback}

Your first action item: ${aiContent.firstAction}

Looking forward to supporting you over the next 12 weeks!

Best,
Your Go Coach`
    };
    
    const result = await sendEmailWithRetry(mailOptions);
    
    if (result.success) {
      // Log the welcome email
      await logEmailHistory(
        userData.id, 
        0, 
        aiContent.firstAction, 
        mailOptions.subject, 
        htmlContent
      );
    }
    
    return result;
    
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
};

// Send weekly email
const sendEmail = async (emailData, templateType = 'weekly') => {
  try {
    const template = await loadTemplate(templateType);
    
    // Calculate progress percentage
    const progressPercent = Math.round((emailData.weekNumber / emailData.totalWeeks) * 100);
    
    const templateData = {
      WEEK_NUMBER: emailData.weekNumber,
      TOTAL_WEEKS: emailData.totalWeeks || 12,
      PROGRESS_PERCENT: progressPercent,
      PREVIOUS_ACTION: emailData.previousAction,
      ENCOURAGEMENT: emailData.encouragement || 'Great work',
      NEW_ACTION: emailData.newAction,
      GOAL_CONNECTION: emailData.goalConnection,
      USER_GOALS: emailData.userGoals || ''
    };
    
    const htmlContent = processTemplate(template, templateData);
    
    const mailOptions = {
      from: `"Go Leadership Coach" <${process.env.EMAIL_USER || 'coach@go-leadership.app'}>`,
      to: emailData.to,
      subject: emailData.subject,
      html: htmlContent,
      text: generateTextVersion(templateData)
    };
    
    const result = await sendEmailWithRetry(mailOptions);
    return result.success;
    
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

// Generate plain text version of email
const generateTextVersion = (data) => {
  let text = `Week ${data.WEEK_NUMBER} - Go Leadership Program\n\n`;
  
  if (data.PREVIOUS_ACTION) {
    text += `Last week's focus: ${data.PREVIOUS_ACTION}\n`;
    text += `${data.ENCOURAGEMENT} on taking that step!\n\n`;
  }
  
  text += `This week's action:\n${data.NEW_ACTION}\n\n`;
  text += `${data.GOAL_CONNECTION}\n\n`;
  text += `You're ${data.WEEK_NUMBER} weeks into your leadership journey. Keep up the excellent work!\n\n`;
  text += `Best regards,\nYour Go Coach\n\n`;
  text += `This is week ${data.WEEK_NUMBER} of your 12-week Go leadership program.`;
  
  return text;
};

// Send email with retry logic
const sendEmailWithRetry = async (mailOptions, maxRetries = 3) => {
  const transporter = createTransporter();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Sending email to ${mailOptions.to} (attempt ${attempt})`);
      
      const info = await transporter.sendMail(mailOptions);
      
      console.log(`Email sent successfully: ${info.messageId}`);
      return { 
        success: true, 
        messageId: info.messageId,
        attempt: attempt 
      };
      
    } catch (error) {
      console.error(`Email send attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        return { 
          success: false, 
          error: error.message,
          attempts: attempt 
        };
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Test email functionality
const testEmail = async (testEmail = 'test@example.com') => {
  console.log('Testing email service...');
  
  try {
    const testData = {
      to: testEmail,
      subject: 'Test Email from Go Leadership App',
      weekNumber: 1,
      totalWeeks: 12,
      previousAction: null,
      encouragement: 'Great start',
      newAction: 'Take 15 minutes to reflect on your leadership style and write down three strengths you bring to your role.',
      goalConnection: 'This self-reflection will help you build awareness of your current leadership foundation.'
    };
    
    const result = await sendEmail(testData, 'weekly');
    
    if (result) {
      console.log('✅ Test email sent successfully');
      return true;
    } else {
      console.log('❌ Test email failed');
      return false;
    }
    
  } catch (error) {
    console.error('Email test failed:', error);
    return false;
  }
};

// Verify email configuration
const verifyEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ Email configuration verified');
    return true;
  } catch (error) {
    console.error('❌ Email configuration error:', error);
    return false;
  }
};

// Send bulk emails (for admin use)
const sendBulkEmails = async (emailList) => {
  const results = [];
  
  for (const emailData of emailList) {
    try {
      const result = await sendEmail(emailData);
      results.push({
        email: emailData.to,
        success: result,
        timestamp: new Date()
      });
      
      // Small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      results.push({
        email: emailData.to,
        success: false,
        error: error.message,
        timestamp: new Date()
      });
    }
  }
  
  return results;
};

// Export all functions
module.exports = {
  sendWelcomeEmail,
  sendEmail,
  testEmail,
  verifyEmailConfig,
  sendBulkEmails,
  loadTemplate,
  processTemplate
};