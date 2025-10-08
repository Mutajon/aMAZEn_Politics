// src/dev/performanceMonitor.ts
// Performance monitoring and analytics for optimization
//
// Tracks:
// - Screen load times (from splash to each screen)
// - EventScreen presentation steps (detailed timing)
// - API call durations and success rates
// - Memory usage snapshots
//
// Used by: Development/optimization work
// Attached to window in storesDebug.ts

// ============================================================================
// TYPES
// ============================================================================

export type ScreenTiming = {
  route: string;
  loadTime: number;        // Time to load this screen
  totalTime: number;       // Total time since session start
  timestamp: number;
};

export type EventScreenTiming = {
  day: number;
  phases: {
    collecting?: number;   // Data collection phase
    presenting?: number;   // Presentation phase
    interacting?: number;  // User interaction phase
    cleaning?: number;     // Cleanup phase
  };
  steps: {
    step0?: number;        // ResourceBar
    step1?: number;        // SupportList
    step2?: number;        // Support Changes (Day 2+)
    step3?: number;        // NewsTicker
    step4?: number;        // PlayerStatusStrip
    step5?: number;        // DilemmaCard
    step5A?: number;       // Compass Pills (Day 2+)
    step6?: number;        // MirrorCard
    step7?: number;        // ActionDeck
  };
  apiCalls: APICallTiming[];
  totalTime?: number;      // Total EventScreen time
  timestamp: number;
};

export type APICallTiming = {
  endpoint: string;
  duration: number;
  success: boolean;
  timestamp: number;
  errorMessage?: string;
};

export type PerformanceData = {
  sessionStart: number;
  enabled: boolean;
  screens: ScreenTiming[];
  eventScreens: EventScreenTiming[];
  apiCalls: APICallTiming[];
};

// ============================================================================
// PERFORMANCE MONITOR CLASS
// ============================================================================

class PerformanceMonitor {
  private data: PerformanceData;
  private currentRoute: string | null = null;
  private currentRouteStart: number | null = null;

  // EventScreen tracking
  private currentEventDay: number | null = null;
  private currentEventTiming: EventScreenTiming | null = null;
  private phaseStartTimes: Map<string, number> = new Map();
  private stepStartTimes: Map<string, number> = new Map();

  constructor() {
    this.data = {
      sessionStart: Date.now(),
      enabled: true,
      screens: [],
      eventScreens: [],
      apiCalls: []
    };
  }

  // ========================================================================
  // SESSION MANAGEMENT
  // ========================================================================

  markSessionStart(): void {
    if (!this.data.enabled) return;
    this.data.sessionStart = Date.now();
    console.log(`[PerfMonitor] 🚀 Session started at ${new Date(this.data.sessionStart).toISOString()}`);
  }

  enable(): void {
    this.data.enabled = true;
    console.log("[PerfMonitor] ✅ Performance tracking enabled");
  }

  disable(): void {
    this.data.enabled = false;
    console.log("[PerfMonitor] ⏸️  Performance tracking disabled");
  }

  clear(): void {
    this.data = {
      sessionStart: Date.now(),
      enabled: this.data.enabled,
      screens: [],
      eventScreens: [],
      apiCalls: []
    };
    this.currentRoute = null;
    this.currentRouteStart = null;
    this.currentEventDay = null;
    this.currentEventTiming = null;
    this.phaseStartTimes.clear();
    this.stepStartTimes.clear();
    console.log("[PerfMonitor] 🗑️  Performance data cleared");
  }

  // ========================================================================
  // SCREEN TRACKING
  // ========================================================================

  onRouteChange(newRoute: string): void {
    if (!this.data.enabled) return;

    const now = Date.now();

    // If we have a previous route, record its timing
    if (this.currentRoute && this.currentRouteStart) {
      const loadTime = now - this.currentRouteStart;
      const totalTime = now - this.data.sessionStart;

      this.data.screens.push({
        route: this.currentRoute,
        loadTime,
        totalTime,
        timestamp: this.currentRouteStart
      });

      console.log(`[PerfMonitor] 📍 Screen: ${this.currentRoute} | Load: ${loadTime}ms | Total: ${totalTime}ms`);
    }

    // Start tracking new route
    this.currentRoute = newRoute;
    this.currentRouteStart = now;
  }

  // ========================================================================
  // EVENT SCREEN TRACKING
  // ========================================================================

  startEventScreen(day: number): void {
    if (!this.data.enabled) return;

    // Finalize previous EventScreen if exists
    if (this.currentEventTiming) {
      this.finalizeEventScreen();
    }

    this.currentEventDay = day;
    this.currentEventTiming = {
      day,
      phases: {},
      steps: {},
      apiCalls: [],
      timestamp: Date.now()
    };

    console.log(`[PerfMonitor] 🎮 EventScreen Day ${day} started`);
  }

  startEventPhase(phase: 'collecting' | 'presenting' | 'interacting' | 'cleaning'): void {
    if (!this.data.enabled || !this.currentEventTiming) return;

    this.phaseStartTimes.set(phase, Date.now());
    console.log(`[PerfMonitor]   📌 Phase: ${phase} started`);
  }

  endEventPhase(phase: 'collecting' | 'presenting' | 'interacting' | 'cleaning'): void {
    if (!this.data.enabled || !this.currentEventTiming) return;

    const startTime = this.phaseStartTimes.get(phase);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.currentEventTiming.phases[phase] = duration;
      this.phaseStartTimes.delete(phase);
      console.log(`[PerfMonitor]   ✓ Phase: ${phase} completed in ${duration}ms`);
    }
  }

  startEventStep(step: keyof EventScreenTiming['steps']): void {
    if (!this.data.enabled || !this.currentEventTiming) return;

    this.stepStartTimes.set(step, Date.now());
  }

  endEventStep(step: keyof EventScreenTiming['steps']): void {
    if (!this.data.enabled || !this.currentEventTiming) return;

    const startTime = this.stepStartTimes.get(step);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.currentEventTiming.steps[step] = duration;
      this.stepStartTimes.delete(step);
      console.log(`[PerfMonitor]     • Step ${step}: ${duration}ms`);
    }
  }

  addEventAPICall(endpoint: string, duration: number, success: boolean, errorMessage?: string): void {
    if (!this.data.enabled) return;

    const timing: APICallTiming = {
      endpoint,
      duration,
      success,
      timestamp: Date.now(),
      errorMessage
    };

    // Add to global API calls
    this.data.apiCalls.push(timing);

    // Add to current EventScreen if tracking
    if (this.currentEventTiming) {
      this.currentEventTiming.apiCalls.push(timing);
    }

    const statusIcon = success ? '✅' : '❌';
    console.log(`[PerfMonitor]   ${statusIcon} API: ${endpoint} | ${duration}ms ${errorMessage ? `| Error: ${errorMessage}` : ''}`);
  }

  private finalizeEventScreen(): void {
    if (!this.currentEventTiming) return;

    // Calculate total time
    const totalTime = Date.now() - this.currentEventTiming.timestamp;
    this.currentEventTiming.totalTime = totalTime;

    // Store completed EventScreen
    this.data.eventScreens.push(this.currentEventTiming);

    console.log(`[PerfMonitor] 🏁 EventScreen Day ${this.currentEventDay} completed | Total: ${totalTime}ms`);

    // Reset tracking
    this.currentEventDay = null;
    this.currentEventTiming = null;
    this.phaseStartTimes.clear();
    this.stepStartTimes.clear();
  }

  // ========================================================================
  // ANALYTICS
  // ========================================================================

  getReport(): PerformanceData {
    // Finalize current EventScreen if exists
    if (this.currentEventTiming) {
      this.finalizeEventScreen();
    }

    return { ...this.data };
  }

  getEventStepAverages(): Record<string, number> {
    const stepTotals: Record<string, number[]> = {};

    this.data.eventScreens.forEach(event => {
      Object.entries(event.steps).forEach(([step, duration]) => {
        if (duration) {
          if (!stepTotals[step]) stepTotals[step] = [];
          stepTotals[step].push(duration);
        }
      });
    });

    const averages: Record<string, number> = {};
    Object.entries(stepTotals).forEach(([step, durations]) => {
      averages[step] = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    });

    return averages;
  }

  getScreenAverages(): Record<string, number> {
    const screenTotals: Record<string, number[]> = {};

    this.data.screens.forEach(screen => {
      if (!screenTotals[screen.route]) screenTotals[screen.route] = [];
      screenTotals[screen.route].push(screen.loadTime);
    });

    const averages: Record<string, number> = {};
    Object.entries(screenTotals).forEach(([route, loadTimes]) => {
      averages[route] = Math.round(loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length);
    });

    return averages;
  }

  getAPIStats(): {
    count: number;
    totalDuration: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    successRate: number;
    byEndpoint: Record<string, {
      count: number;
      avgDuration: number;
      successRate: number;
    }>;
  } {
    const calls = this.data.apiCalls;

    if (calls.length === 0) {
      return {
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        successRate: 0,
        byEndpoint: {}
      };
    }

    const durations = calls.map(c => c.duration);
    const successCount = calls.filter(c => c.success).length;

    // Group by endpoint
    const byEndpoint: Record<string, APICallTiming[]> = {};
    calls.forEach(call => {
      if (!byEndpoint[call.endpoint]) byEndpoint[call.endpoint] = [];
      byEndpoint[call.endpoint].push(call);
    });

    const endpointStats: Record<string, { count: number; avgDuration: number; successRate: number }> = {};
    Object.entries(byEndpoint).forEach(([endpoint, endpointCalls]) => {
      const avgDuration = Math.round(
        endpointCalls.reduce((sum, c) => sum + c.duration, 0) / endpointCalls.length
      );
      const successRate = (endpointCalls.filter(c => c.success).length / endpointCalls.length) * 100;

      endpointStats[endpoint] = {
        count: endpointCalls.length,
        avgDuration,
        successRate: Math.round(successRate)
      };
    });

    return {
      count: calls.length,
      totalDuration: durations.reduce((a, b) => a + b, 0),
      avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      successRate: Math.round((successCount / calls.length) * 100),
      byEndpoint: endpointStats
    };
  }

  export(): string {
    const data = this.getReport();
    return JSON.stringify(data, null, 2);
  }

  download(): void {
    const json = this.export();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log("[PerfMonitor] 💾 Performance data downloaded");
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const perfMonitor = new PerformanceMonitor();

// ============================================================================
// CONSOLE API
// ============================================================================

export function attachPerformanceMonitor() {
  const g = window as any;

  g.perfMonitor = perfMonitor;

  g.performanceReport = () => {
    const report = perfMonitor.getReport();

    console.groupCollapsed(
      "%c[Performance Report]",
      "color:#10b981;font-weight:bold;font-size:14px;padding:4px 8px;border-radius:4px;background:#064e3b"
    );

    console.log(`Session start: ${new Date(report.sessionStart).toLocaleString()}`);
    console.log(`Duration: ${Math.round((Date.now() - report.sessionStart) / 1000)}s`);
    console.log(`Enabled: ${report.enabled}`);

    console.groupCollapsed(`📍 Screens (${report.screens.length})`);
    console.table(report.screens);
    console.groupEnd();

    console.groupCollapsed(`🎮 Event Screens (${report.eventScreens.length})`);
    report.eventScreens.forEach(event => {
      console.groupCollapsed(`Day ${event.day} - ${event.totalTime}ms total`);
      console.log("Phases:", event.phases);
      console.log("Steps:", event.steps);
      console.log("API Calls:", event.apiCalls);
      console.groupEnd();
    });
    console.groupEnd();

    console.groupCollapsed(`🌐 API Calls (${report.apiCalls.length})`);
    console.table(report.apiCalls);
    console.groupEnd();

    console.groupEnd();

    return report;
  };

  g.getEventStepAverages = () => {
    const averages = perfMonitor.getEventStepAverages();
    console.log("%c[Event Step Averages]", "color:#10b981;font-weight:bold");
    console.table(averages);
    return averages;
  };

  g.getScreenAverages = () => {
    const averages = perfMonitor.getScreenAverages();
    console.log("%c[Screen Averages]", "color:#10b981;font-weight:bold");
    console.table(averages);
    return averages;
  };

  g.getAPIStats = () => {
    const stats = perfMonitor.getAPIStats();
    console.log("%c[API Statistics]", "color:#10b981;font-weight:bold");
    console.log(`Total calls: ${stats.count}`);
    console.log(`Total duration: ${stats.totalDuration}ms`);
    console.log(`Average duration: ${stats.avgDuration}ms`);
    console.log(`Min/Max: ${stats.minDuration}ms / ${stats.maxDuration}ms`);
    console.log(`Success rate: ${stats.successRate}%`);
    console.log("\nBy endpoint:");
    console.table(stats.byEndpoint);
    return stats;
  };

  g.clearPerformanceData = () => perfMonitor.clear();
  g.exportPerformanceData = () => perfMonitor.download();
  g.enablePerformanceTracking = () => perfMonitor.enable();
  g.disablePerformanceTracking = () => perfMonitor.disable();

  console.info("%c[Performance Monitor] attached", "color:#10b981;font-weight:bold");
  console.info("%c  performanceReport() - View full report", "color:#10b981");
  console.info("%c  getEventStepAverages() - Average duration per presentation step", "color:#10b981");
  console.info("%c  getScreenAverages() - Average load time per screen", "color:#10b981");
  console.info("%c  getAPIStats() - API call statistics", "color:#10b981");
  console.info("%c  clearPerformanceData() - Reset all metrics", "color:#10b981");
  console.info("%c  exportPerformanceData() - Download as JSON", "color:#10b981");
  console.info("%c  enablePerformanceTracking() / disablePerformanceTracking()", "color:#10b981");
}
