import type { Problem } from '../types/index';
import { supabase } from '../lib/supabase';

// Fallback local problems (used if Supabase is unavailable)
const fallbackProblems: Problem[] = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

Example:
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].`,
    starterCode: `def two_sum(nums, target):
    """
    :type nums: List[int]
    :type target: int
    :rtype: List[int]
    """
    # Write your solution here
    pass

# Test
print(two_sum([2, 7, 11, 15], 9))`,
    testCases: [
      { input: '[2, 7, 11, 15], 9', expectedOutput: '[0, 1]' },
      { input: '[3, 2, 4], 6', expectedOutput: '[1, 2]' },
      { input: '[3, 3], 6', expectedOutput: '[0, 1]' },
    ],
  },
  {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    description: `Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

Example:
Input: s = "()"
Output: true

Input: s = "()[]{}"
Output: true

Input: s = "(]"
Output: false`,
    starterCode: `def is_valid(s):
    """
    :type s: str
    :rtype: bool
    """
    # Write your solution here
    pass

# Test
print(is_valid("()"))
print(is_valid("()[]{}"))
print(is_valid("(]"))`,
    testCases: [
      { input: '"()"', expectedOutput: 'True' },
      { input: '"()[]{}"', expectedOutput: 'True' },
      { input: '"(]"', expectedOutput: 'False' },
    ],
  },
  {
    id: 'reverse-linked-list',
    title: 'Reverse Linked List',
    difficulty: 'Easy',
    description: `Given the head of a singly linked list, reverse the list, and return the reversed list.

Example:
Input: head = [1,2,3,4,5]
Output: [5,4,3,2,1]`,
    starterCode: `class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def reverse_list(head):
    """
    :type head: ListNode
    :rtype: ListNode
    """
    # Write your solution here
    pass

# Helper function to print list
def print_list(head):
    result = []
    while head:
        result.append(head.val)
        head = head.next
    print(result)

# Test
node = ListNode(1, ListNode(2, ListNode(3)))
reversed_head = reverse_list(node)
print_list(reversed_head)`,
    testCases: [
      { input: '[1,2,3,4,5]', expectedOutput: '[5,4,3,2,1]' },
      { input: '[1,2]', expectedOutput: '[2,1]' },
      { input: '[]', expectedOutput: '[]' },
    ],
  },
];

/**
 * Fetch problems from Supabase database (LEETCODE PROBLEMS table).
 * Falls back to local problems if Supabase is unavailable.
 */
export const loadProblems = async (): Promise<Problem[]> => {
  try {
    console.log('Attempting to load problems from Supabase...');
    const { data, error } = await supabase
      .from('LEETCODE PROBLEMS')
      .select('*')
      .limit(2000)
      .order('difficulty', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      console.log('Falling back to local problems');
      return fallbackProblems;
    }

    if (!data || data.length === 0) {
      console.warn('No problems found in Supabase, using fallback problems');
      return fallbackProblems;
    }

    // Transform the data to match the Problem interface
    const transformed = data.map((row: any) => {
      // Handle various column naming conventions
      const starterCode = row.starterCode || row.starter_code || row.start_code ||
        `def solution():
    """
    ${row.title || 'Problem'}

    TODO: Implement your solution here
    """
    # Write your solution here
    pass

# Test your solution
print(solution())`;

      const testCases = (() => {
        let tc = row.testCases || row.test_cases || row.tests || [];
        if (typeof tc === 'string') {
          try {
            tc = JSON.parse(tc);
          } catch {
            tc = [];
          }
        }
        return Array.isArray(tc) && tc.length > 0 ? tc : [
          { input: 'test input', expectedOutput: 'expected output' }
        ];
      })();

      return {
        id: String(row.id || row.problem_id || ''),
        title: row.title || '',
        difficulty: (row.difficulty || 'Easy') as 'Easy' | 'Medium' | 'Hard',
        description: row.description || '',
        starterCode,
        testCases,
      };
    });

    console.log(`Successfully loaded ${transformed.length} problems from Supabase`);
    return transformed.length > 0 ? transformed : fallbackProblems;
  } catch (err) {
    console.error('Failed to load problems:', err);
    return fallbackProblems;
  }
};

export const getDefaultProblem = () => fallbackProblems[0];
