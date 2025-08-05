// Intelligent Intent Analysis System
export interface UserIntent {
  isValidRequest: boolean;
  description: string;
  confidence: number;
  category: string;
  keywords: string[];
  extractedData: {
    email?: string;
    subject?: string;
    message?: string;
    filename?: string;
    url?: string;
    database?: string;
    [key: string]: any;
  };
}

export class IntentAnalyzer {
  private browserPatterns = [
    /navigate/i,
    /browser/i,
    /web/i,
    /website/i,
    /url/i,
    /go\s+to/i,
    /visit/i,
    /open/i,
    /click/i,
    /type/i,
    /screenshot/i,
    /snapshot/i,
    /导航/i,
    /浏览器/i,
    /网页/i,
    /网站/i,
    /打开/i,
    /点击/i,
    /输入/i,
    /截图/i
  ];

  private extractionPatterns = {
    url: /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/g,
    text: /"([^"]+)"|'([^']+)'/g,
    element: /element[:\s]+["']?([^"'\n]+)["']?/i
  };

  async parseIntent(userRequest: string): Promise<UserIntent> {
    // Remove "use mcpdog" part
    const cleanRequest = userRequest.replace(/,?\s*use\s+mcpdog\s*$/i, '').trim();
    
    if (!cleanRequest || cleanRequest.length < 3) {
      return {
        isValidRequest: false,
        description: "Request is empty or too short",
        confidence: 0,
        category: "unknown",
        keywords: [],
        extractedData: {}
      };
    }

    // Extract keywords for tool matching
    const keywords = this.extractKeywords(cleanRequest);
    
    // Extract structured data
    const extractedData = this.extractStructuredData(cleanRequest);
    
    // Detect if it's a browser-related request
    const isBrowserRequest = this.isBrowserRelated(cleanRequest);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(cleanRequest, keywords);

    // Generate friendly description
    const description = this.generateDescription(cleanRequest, extractedData);

    return {
      isValidRequest: true,
      description,
      confidence,
      category: isBrowserRequest ? 'browser' : 'general',
      keywords,
      extractedData
    };
  }

  private isBrowserRelated(request: string): boolean {
    return this.browserPatterns.some(pattern => pattern.test(request));
  }

  private extractKeywords(request: string): string[] {
    const keywords = new Set<string>();

    // Extract keywords from request (simple word splitting)
    const words = request.toLowerCase().match(/\b\w+\b/g) || [];
    words.forEach(word => {
      if (word.length > 2 && !['the', 'and', 'or', 'but', 'to', 'use', 'mcpdog', 'com', 'www'].includes(word)) {
        keywords.add(word);
      }
    });

    return Array.from(keywords);
  }

  private extractStructuredData(request: string): { [key: string]: any } {
    const data: { [key: string]: any } = {};

    // Extract URL
    const urlMatches = request.match(this.extractionPatterns.url);
    if (urlMatches) {
      data.url = urlMatches[0];
      // If no protocol, add https://
      if (!data.url.startsWith('http')) {
        data.url = 'https://' + data.url;
      }
    }

    // Extract text in quotes
    const textMatches = request.match(this.extractionPatterns.text);
    if (textMatches) {
      data.text = textMatches[0].slice(1, -1); // Remove quotes
    }

    // Extract common website names and convert to URLs
    const commonSites = {
      'google': 'https://www.google.com',
      'youtube': 'https://www.youtube.com',
      'github': 'https://www.github.com',
      'stackoverflow': 'https://stackoverflow.com',
      'reddit': 'https://www.reddit.com',
      'twitter': 'https://www.twitter.com',
      'facebook': 'https://www.facebook.com'
    };

    for (const [site, url] of Object.entries(commonSites)) {
      if (request.toLowerCase().includes(site) && !data.url) {
        data.url = url;
        break;
      }
    }

    return data;
  }

  private calculateConfidence(request: string, keywords: string[]): number {
    let confidence = 0.5; // Base score

    // Browser pattern matching bonus
    const browserMatches = this.browserPatterns.filter(pattern => pattern.test(request)).length;
    confidence += browserMatches * 0.15;

    // Keyword count bonus
    confidence += Math.min(keywords.length * 0.05, 0.2);

    // Structured data bonus
    const structuredData = this.extractStructuredData(request);
    confidence += Object.keys(structuredData).length * 0.1;

    // Request length bonus (moderate length is better)
    if (request.length > 5 && request.length < 200) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private generateDescription(request: string, extractedData: any): string {
    let description = request;

    // Add specific details
    if (extractedData.url) {
      description = `Browser operation (target: ${extractedData.url})`;  
    } else if (extractedData.text) {
      description = `Browser operation (text: ${extractedData.text})`;
    } else if (this.isBrowserRelated(request)) {
      description = `Browser operation: ${request}`;
    }

    return description;
  }
}