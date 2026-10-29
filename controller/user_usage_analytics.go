package controller

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetUserUsageAnalytics(c *gin.Context) {
	if c.GetInt("role") < common.RoleCommonUser {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "Insufficient permissions"})
		return
	}
	startTime, startErr := strconv.ParseInt(c.DefaultQuery("start_timestamp", "0"), 10, 64)
	endTime, endErr := strconv.ParseInt(c.DefaultQuery("end_timestamp", strconv.FormatInt(time.Now().Unix(), 10)), 10, 64)
	if startErr != nil || endErr != nil || startTime < 0 || endTime <= 0 || endTime < startTime {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid time range"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	rows, err := model.GetUserUsageAnalytics(ctx, startTime, endTime)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": rows})
}
