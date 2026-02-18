I am replacing my existing signup flow with a waitlist flow. I want to not delete my signup page, keep that, but just omit it from public views for now. I want to add a new page for the waitlist that has the same UI but different copy and backend logic.

IMPORTANT:

Keep the UI visually identical to my current signup page.

Only change the copy and the backend logic.

The page should now say “Join the Waitlist”.

Add messaging explaining that we are onboarding a limited number of pilot teams to test out the platform and give feedback.

Tone should feel intentional and high-quality, not apologetic.

We are collecting the following fields:

Required:

email (string, unique, validated)

Optional:

first_name (string)

Additional required fields:

role (enum: "individual", "team", "developer", "other")

primary_problem (text)

urgency (enum: "exploring", "3_months", "asap")

early_access_payment (enum: "yes", "maybe", "not_now")

Tasks:

Database
Create a Supabase table called waitlist with:

id (uuid, primary key, default gen_random_uuid())

email (text, unique, not null)

first_name (text)

role (text, not null)

primary_problem (text)

urgency (text, not null)

early_access_payment (text, not null)

created_at (timestamp with time zone, default now())

Add appropriate constraints for enums using check constraints.

Frontend
Modify existing signup form component to:

Keep layout identical.

Change header to: "Join the Waitlist"

Add subtext:
"We're onboarding a small number of pilot teams as part of our launch. Join the waitlist to be considered for early access."

Form behavior:

On submit, insert into waitlist table using Supabase client.

Show success state:
"You're on the list. We'll reach out soon."

Email Flow (Supabase Edge Function)
Create a Supabase Edge Function named waitlist-confirmation.

Behavior:

Accept POST request with waitlist payload.

Send confirmation email using Mailgun API.

Email subject: "You're on the Waitlist"

Email body:

Thank them for joining.

Reiterate that we are onboarding a limited number of pilot teams.

Mention we will prioritize based on fit and urgency.

Keep tone confident and premium.

Also:

Send internal notification email to our team with full submission details.

Implementation details:

Use Deno environment.

Store MAILGUN_API_KEY as environment variable (plus MAILGUN_DOMAIN, MAILGUN_FROM_EMAIL, WAITLIST_INTERNAL_EMAIL).

Use fetch to call Mailgun API.

Return proper JSON response and status codes.

Triggering Email
After successful insert into Supabase:

Call the edge function from frontend with submission payload.
OR

Optionally suggest using database webhook if cleaner.

Make sure:

Duplicate emails are gracefully handled.

Email validation is enforced.

Code is production clean and modular.

Provide:

SQL for table creation.

Frontend code modifications.

Edge function code.

Deployment instructions for Supabase Edge Function.

Do not change overall app structure.
Keep implementation minimal and clean.
