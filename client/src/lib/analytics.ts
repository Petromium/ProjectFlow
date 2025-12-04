// Google Analytics Integration
// Blueprint: javascript_google_analytics

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

// Initialize Google Analytics
export const initGA = () => {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;

  if (!measurementId) {
    console.warn('Missing required Google Analytics key: VITE_GA_MEASUREMENT_ID');
    return;
  }

  // Add Google Analytics script to the head
  const script1 = document.createElement('script');
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script1);

  // Initialize gtag
  const script2 = document.createElement('script');
  script2.textContent = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${measurementId}');
  `;
  document.head.appendChild(script2);
};

// Track page views - useful for single-page applications
// Note: Enhanced version with title parameter is defined below

// Track events
export const trackEvent = (
  action: string, 
  category?: string, 
  label?: string, 
  value?: number
) => {
  if (typeof window === 'undefined' || !window.gtag) return;
  
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};

// Track user login
export const trackLogin = (method: string = 'replit') => {
  trackEvent('login', 'authentication', method);
};

// Track project creation
export const trackProjectCreated = (projectId: number) => {
  trackEvent('project_created', 'projects', `project_${projectId}`);
};

// Track task creation
export const trackTaskCreated = (projectId: number, taskId: number) => {
  trackEvent('task_created', 'tasks', `project_${projectId}_task_${taskId}`);
};

// Track risk creation
export const trackRiskCreated = (projectId: number) => {
  trackEvent('risk_created', 'risks', `project_${projectId}`);
};

// Track issue creation
export const trackIssueCreated = (projectId: number) => {
  trackEvent('issue_created', 'issues', `project_${projectId}`);
};

// Track report generation
export const trackReportGenerated = (reportType: string, projectId: number) => {
  trackEvent('report_generated', 'reports', `${reportType}_project_${projectId}`);
};

// Track AI assistant usage
export const trackAIChat = (projectId: number) => {
  trackEvent('ai_chat_message', 'ai_assistant', `project_${projectId}`);
};

// Track file upload
export const trackFileUpload = (fileType: string) => {
  trackEvent('file_uploaded', 'storage', fileType);
};

// Marketing & Conversion Tracking
export const trackSignup = (method: string = 'email') => {
  trackEvent('sign_up', 'conversion', method);
  // Mark as conversion for GA4
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'sign_up', {
      method: method
    });
  }
};

export const trackTrialStart = (planTier: string) => {
  trackEvent('trial_start', 'conversion', planTier);
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'begin_checkout', {
      currency: 'USD',
      value: 0,
      items: [{
        item_name: planTier,
        item_category: 'subscription'
      }]
    });
  }
};

export const trackPurchase = (planTier: string, price: number) => {
  trackEvent('purchase', 'conversion', planTier, price);
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'purchase', {
      transaction_id: `purchase_${Date.now()}`,
      value: price,
      currency: 'USD',
      items: [{
        item_name: planTier,
        item_category: 'subscription',
        price: price
      }]
    });
  }
};

export const trackCTAClick = (ctaLocation: string, ctaText: string) => {
  trackEvent('cta_click', 'marketing', `${ctaLocation}_${ctaText}`);
};

export const trackPageView = (url: string, title?: string) => {
  if (typeof window === 'undefined' || !window.gtag) return;
  
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (!measurementId) return;
  
  window.gtag('config', measurementId, {
    page_path: url,
    page_title: title
  });
};
