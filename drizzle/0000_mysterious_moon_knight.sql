CREATE TYPE "public"."payment_mode" AS ENUM('Credit Card', 'Debit Card', 'UPI', 'Cash');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('expense', 'income', 'donation', 'lent');--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"legacy_firestore_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budgets_month_unique" UNIQUE("month"),
	CONSTRAINT "budgets_legacy_firestore_id_unique" UNIQUE("legacy_firestore_id"),
	CONSTRAINT "budgets_amount_positive" CHECK ("budgets"."amount" > 0),
	CONSTRAINT "budgets_month_first_day" CHECK (extract(day from "budgets"."month") = 1)
);
--> statement-breakpoint
CREATE TABLE "expense_splits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"person" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_received" boolean DEFAULT false NOT NULL,
	"payment_received_at" timestamp with time zone,
	CONSTRAINT "expense_splits_expense_position_uq" UNIQUE("expense_id","position"),
	CONSTRAINT "expense_splits_amount_nonneg" CHECK ("expense_splits"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_mode" "payment_mode" NOT NULL,
	"for_whom" text NOT NULL,
	"date" date NOT NULL,
	"transaction_type" "transaction_type" DEFAULT 'expense' NOT NULL,
	"payment_received" boolean DEFAULT false NOT NULL,
	"payment_received_at" timestamp with time zone,
	"is_split" boolean DEFAULT false NOT NULL,
	"category" text,
	"legacy_firestore_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_legacy_firestore_id_unique" UNIQUE("legacy_firestore_id"),
	CONSTRAINT "expenses_amount_positive" CHECK ("expenses"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_splits_expense_idx" ON "expense_splits" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("date");