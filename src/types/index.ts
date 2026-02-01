export interface Problem {
  id: string;
  title: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  starterCode: string;
  testCases: TestCase[];
}

export interface TestCase {
  input: string;
  expectedOutput: string;
}

export interface CodeExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime?: number;
}

export interface InterviewerHint {
  message: string;
  type: 'hint' | 'question' | 'encouragement';
}

export interface SessionFeedback {
  strengths: string[];
  weaknesses: string[];
  suggestedTopics: string[];
  overallScore?: number;
  detailedFeedback: string;
  rubricScores?: {
    beforeCoding: number;
    duringCoding: number;
    afterCoding: number;
  };
  telemetry?: {
    timestamp: number;
    type: 'feedback';
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latency: number;
    success: boolean;
    error?: string;
  };
}

export interface InterviewSession {
  id: string;
  problemId: string;
  startTime: Date;
  endTime?: Date;
  code: string;
  hintsRequested: number;
  codeExecutions: number;
  feedback?: SessionFeedback;
}

export type InterviewerMode = 'v1' | 'v2';
