package model

import (
	"context"
)

// UserUsageAnalyticsRow contains recorded consumption, never current-price estimates.
type UserUsageAnalyticsRow struct {
	UserID           int    `json:"user_id"`
	Username         string `json:"username"`
	DisplayName      string `json:"display_name" gorm:"-"`
	ModelName        string `json:"model_name"`
	RequestCount     int64  `json:"request_count"`
	Quota            int64  `json:"quota"`
	PromptTokens     int64  `json:"prompt_tokens"`
	CompletionTokens int64  `json:"completion_tokens"`
	FirstUsedAt      int64  `json:"first_used_at"`
	LastUsedAt       int64  `json:"last_used_at"`
}

func GetUserUsageAnalytics(ctx context.Context, startTime, endTime int64) ([]UserUsageAnalyticsRow, error) {
	rows := make([]UserUsageAnalyticsRow, 0)
	err := LOG_DB.WithContext(ctx).Model(&Log{}).
		Select(`user_id, MAX(username) AS username, model_name,
			COUNT(*) AS request_count, COALESCE(SUM(quota), 0) AS quota,
			COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
			COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
			MIN(created_at) AS first_used_at, MAX(created_at) AS last_used_at`).
		Where("type = ? AND user_id > 0 AND created_at >= ? AND created_at <= ?", LogTypeConsume, startTime, endTime).
		Group("user_id, model_name").
		Order("user_id ASC, model_name ASC").
		Scan(&rows).Error
	if err != nil || len(rows) == 0 {
		return rows, err
	}

	ids := make([]int, 0)
	seen := make(map[int]bool)
	for _, row := range rows {
		if !seen[row.UserID] {
			ids = append(ids, row.UserID)
			seen[row.UserID] = true
		}
	}
	// Main and log databases can be separate. Do not join them or expose user secrets.
	var users []User
	if err := DB.WithContext(ctx).Unscoped().Select("id", "username", "display_name").Where("id IN ?", ids).Find(&users).Error; err != nil {
		return nil, err
	}
	lookup := make(map[int]User, len(users))
	for _, user := range users {
		lookup[user.Id] = user
	}
	for i := range rows {
		if user, exists := lookup[rows[i].UserID]; exists {
			rows[i].Username = user.Username
			rows[i].DisplayName = user.DisplayName
		}
	}
	return rows, nil
}
