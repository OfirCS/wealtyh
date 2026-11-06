ALTER TABLE "households" ADD COLUMN "stripe_customer" text;--> statement-breakpoint
ALTER TABLE "households" ADD CONSTRAINT "households_stripe_customer_unique" UNIQUE("stripe_customer");