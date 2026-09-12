const asyncHandler =
  require('../../utils/asyncHandler');

const ApiResponse =
  require('../../utils/ApiResponse');

const reportService =
  require('./report.service');

const {
  runMaintenanceSweep,
} = require('../../jobs/scheduler');

const dashboard =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const summary =
        await reportService
          .getDashboardSummary();

      return new ApiResponse(
        200,
        summary
      ).send(res);
    }
  );

const inventoryHealth =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const result =
        await reportService
          .getInventoryHealth();

      return new ApiResponse(
        200,
        result
      ).send(res);
    }
  );

const topBooks =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const books =
        await reportService
          .getMostBorrowedBooks(
            req.query.limit
          );

      return new ApiResponse(
        200,
        books
      ).send(res);
    }
  );

const overdue =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const loans =
        await reportService
          .getOverdueLoans();

      return new ApiResponse(
        200,
        loans
      ).send(res);
    }
  );

const circulation =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const stats =
        await reportService
          .getCirculationStats(
            req.query.days
          );

      return new ApiResponse(
        200,
        stats
      ).send(res);
    }
  );

const fineRevenue =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const report =
        await reportService
          .getFineRevenueReport();

      return new ApiResponse(
        200,
        report
      ).send(res);
    }
  );

const exportOverdueCsv =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const csv =
        await reportService
          .exportOverdueCsv();

      res.setHeader(
        'Content-Type',
        'text/csv; charset=utf-8'
      );

      res.setHeader(
        'Content-Disposition',
        'attachment; filename="overdue-loans.csv"'
      );

      res
        .status(200)
        .send(csv);
    }
  );

const exportInventoryCsv =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const csv =
        await reportService
          .exportInventoryCsv();

      res.setHeader(
        'Content-Type',
        'text/csv; charset=utf-8'
      );

      res.setHeader(
        'Content-Disposition',
        'attachment; filename="inventory-report.csv"'
      );

      res
        .status(200)
        .send(csv);
    }
  );

const runMaintenance =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const result =
        await runMaintenanceSweep();

      return new ApiResponse(
        200,
        result,
        'Maintenance sweep completed'
      ).send(res);
    }
  );

module.exports = {
  dashboard,
  inventoryHealth,
  topBooks,
  overdue,
  circulation,
  fineRevenue,
  exportOverdueCsv,
  exportInventoryCsv,
  runMaintenance,
};