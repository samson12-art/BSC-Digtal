const { calculateAchievementPercentage, getNextReviewerRole, getRoleLabel } = require('../src/utils/helpers');

describe('Helper Functions', () => {
  describe('calculateAchievementPercentage', () => {
    it('should calculate correct percentage', () => {
      expect(calculateAchievementPercentage(150, 200)).toBe(75);
    });

    it('should return 0 when target is 0', () => {
      expect(calculateAchievementPercentage(100, 0)).toBe(0);
    });

    it('should return 0 when target is null', () => {
      expect(calculateAchievementPercentage(100, null)).toBe(0);
    });

    it('should return 0 when target is undefined', () => {
      expect(calculateAchievementPercentage(100, undefined)).toBe(0);
    });

    it('should cap at 150%', () => {
      expect(calculateAchievementPercentage(300, 100)).toBe(150);
    });

    it('should return 100 for exact target', () => {
      expect(calculateAchievementPercentage(200, 200)).toBe(100);
    });

    it('should cap at 150 when exceeded', () => {
      expect(calculateAchievementPercentage(7, 3)).toBe(150);
    });

    it('should round to nearest integer', () => {
      expect(calculateAchievementPercentage(17, 20)).toBe(85);
    });
  });

  describe('getNextReviewerRole', () => {
    it('should return TEAM_LEADER for EMPLOYEE', () => {
      expect(getNextReviewerRole('EMPLOYEE')).toBe('TEAM_LEADER');
    });

    it('should return DEPARTMENT_MANAGER for TEAM_LEADER', () => {
      expect(getNextReviewerRole('TEAM_LEADER')).toBe('DEPARTMENT_MANAGER');
    });

    it('should return EXECUTIVE_MANAGER for DEPARTMENT_MANAGER', () => {
      expect(getNextReviewerRole('DEPARTMENT_MANAGER')).toBe('EXECUTIVE_MANAGER');
    });

    it('should return CEO for EXECUTIVE_MANAGER', () => {
      expect(getNextReviewerRole('EXECUTIVE_MANAGER')).toBe('CEO');
    });

    it('should return BOARD_MEMBER for CEO', () => {
      expect(getNextReviewerRole('CEO')).toBe('BOARD_MEMBER');
    });

    it('should return undefined for unknown role', () => {
      expect(getNextReviewerRole('UNKNOWN')).toBeUndefined();
    });
  });

  describe('getRoleLabel', () => {
    it('should return correct label for each role', () => {
      expect(getRoleLabel('BOARD_MEMBER')).toBe('Board of Directors');
      expect(getRoleLabel('CEO')).toBe('Chief Executive Officer');
      expect(getRoleLabel('EXECUTIVE_MANAGER')).toBe('Executive Manager');
      expect(getRoleLabel('DEPARTMENT_MANAGER')).toBe('Department Manager');
      expect(getRoleLabel('TEAM_LEADER')).toBe('Team Leader');
      expect(getRoleLabel('EMPLOYEE')).toBe('Employee');
    });

    it('should return raw role for unknown', () => {
      expect(getRoleLabel('UNKNOWN')).toBe('UNKNOWN');
    });
  });
});
