package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUserUsageAnalyticsAggregatesAllUsersAndModelsFromConsumptionLogs(t *testing.T) {
	db := setupManageUserTestDB(t)
	for id := 1; id <= 12; id++ {
		require.NoError(t, db.Create(&model.User{Id: id, Username: fmt.Sprintf("current-%02d", id), DisplayName: "Display", AffCode: fmt.Sprintf("analytics-%d", id)}).Error)
		require.NoError(t, model.LOG_DB.Create(&model.Log{
			UserId: id, Username: "old-name", Type: model.LogTypeConsume, ModelName: "model-a",
			CreatedAt: 100, Quota: 1500000000, PromptTokens: 200, CompletionTokens: 50,
		}).Error)
	}
	require.NoError(t, db.Delete(&model.User{}, 2).Error)
	for _, row := range []model.Log{
		{UserId: 1, Username: "newer-name", Type: model.LogTypeConsume, ModelName: "model-a", CreatedAt: 200, Quota: 1500000000, PromptTokens: 300, CompletionTokens: 20},
		{UserId: 1, Username: "old-name", Type: model.LogTypeConsume, ModelName: "free-model", CreatedAt: 300, PromptTokens: 40, CompletionTokens: 10},
		{UserId: 1, Type: model.LogTypeConsume, ModelName: "outside", CreatedAt: 99, Quota: 999},
		{UserId: 1, Type: model.LogTypeConsume, ModelName: "outside", CreatedAt: 301, Quota: 999},
		{UserId: 1, Type: model.LogTypeTopup, CreatedAt: 150, Quota: 999},
		{UserId: 1, Type: model.LogTypeError, CreatedAt: 150, Quota: 999},
		{UserId: 1, Type: model.LogTypeRefund, CreatedAt: 150, Quota: 999},
		{UserId: 0, Type: model.LogTypeConsume, CreatedAt: 150, Quota: 999},
	} {
		require.NoError(t, model.LOG_DB.Create(&row).Error)
	}

	recorder := performUserUsageAnalyticsRequest("?start_timestamp=100&end_timestamp=300", common.RoleRootUser)
	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool                          `json:"success"`
		Data    []model.UserUsageAnalyticsRow `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Len(t, response.Data, 13)
	assert.Equal(t, model.UserUsageAnalyticsRow{
		UserID: 1, Username: "current-01", DisplayName: "Display", ModelName: "free-model",
		RequestCount: 1, PromptTokens: 40, CompletionTokens: 10, FirstUsedAt: 300, LastUsedAt: 300,
	}, response.Data[0])
	assert.Equal(t, int64(3000000000), response.Data[1].Quota)
	assert.Equal(t, int64(2), response.Data[1].RequestCount)
	assert.Equal(t, int64(500), response.Data[1].PromptTokens)
	assert.Equal(t, int64(70), response.Data[1].CompletionTokens)
	assert.Equal(t, "current-02", response.Data[2].Username)
	assert.NotContains(t, recorder.Body.String(), "password")
	assert.NotContains(t, recorder.Body.String(), "access_token")

	empty := performUserUsageAnalyticsRequest("?start_timestamp=400&end_timestamp=500", common.RoleAdminUser)
	assert.JSONEq(t, `{"success":true,"data":[]}`, empty.Body.String())
}

func TestUserUsageAnalyticsRejectsUnauthenticatedUsersAndInvalidRanges(t *testing.T) {
	for _, role := range []int{0} {
		response := performUserUsageAnalyticsRequest("", role)
		assert.Equal(t, http.StatusForbidden, response.Code)
	}
	for _, query := range []string{
		"?start_timestamp=-1", "?start_timestamp=abc", "?end_timestamp=0",
		"?start_timestamp=200&end_timestamp=100", "?end_timestamp=9223372036854775808",
	} {
		response := performUserUsageAnalyticsRequest(query, common.RoleRootUser)
		assert.Equal(t, http.StatusBadRequest, response.Code, query)
	}
}

func TestUserUsageAnalyticsEnforcesLoginAndLogReadScope(t *testing.T) {
	owner, _ := setupAccessTokenAudit(t)
	require.NoError(t, model.PublishUserAuthCache(owner.Id))
	_, browser := createAccessTokenTestSession(t, owner.Id, "analytics-dashboard-session")
	logReader, _ := createScopedAccessToken(t, owner.Id, 0, "log:read")
	profileReader, _ := createScopedAccessToken(t, owner.Id, 0, "profile:read")
	router := newAccessTokenTestRouter()
	router.GET("/api/data/user-analytics", middleware.UserAuth(), GetUserUsageAnalytics)
	router.GET("/api/data/users", middleware.UserAuth(), GetQuotaDatesByUser)
	router.GET("/api/user/", middleware.AdminAuth(), GetAllUsers)
	for _, tc := range []struct {
		name, credential string
		status           int
	}{
		{"dashboard session", browser, http.StatusOK},
		{"log read token", logReader, http.StatusOK},
		{"missing log scope", profileReader, http.StatusForbidden},
		{"no credentials", "", http.StatusUnauthorized},
	} {
		t.Run(tc.name, func(t *testing.T) {
			response := accessTokenRequest(router, http.MethodGet, "/api/data/user-analytics", tc.credential, "", "")
			assert.Equal(t, tc.status, response.Code, response.Body.String())
		})
	}
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", owner.Id).Update("role", common.RoleCommonUser).Error)
	require.NoError(t, model.PublishUserAuthCache(owner.Id))
	require.NoError(t, model.LOG_DB.Create(&model.Log{UserId: 9999, Username: "another-user", Type: model.LogTypeConsume, ModelName: "shared-model", CreatedAt: 100, Quota: 19, PromptTokens: 33, CompletionTokens: 4}).Error)
	response := accessTokenRequest(router, http.MethodGet, "/api/data/user-analytics", logReader, "", "")
	assert.Equal(t, http.StatusOK, response.Code)
	response = accessTokenRequest(router, http.MethodGet, "/api/data/user-analytics", browser, "", "")
	assert.Equal(t, http.StatusOK, response.Code)
	assert.Contains(t, response.Body.String(), `"user_id":9999`)
	assert.Contains(t, response.Body.String(), `"model_name":"shared-model"`)
	response = accessTokenRequest(router, http.MethodGet, "/api/user/", browser, "", "")
	assert.Equal(t, http.StatusForbidden, response.Code)
}

func performUserUsageAnalyticsRequest(query string, role int) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/data/user-analytics"+query, nil)
	c.Set("role", role)
	GetUserUsageAnalytics(c)
	return recorder
}
