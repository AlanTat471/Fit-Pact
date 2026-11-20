# Numi — where things stand (20 November 2026)

This is the current guide. Version **25** is already on Google Play internal testing. The mobile repair in this working tree is prepared as version **26**. It does **not** use Google Play Billing.

If an older note disagrees with this file, follow this file. `BUGS-AND-DEFECTS.md` is the history of fixes. `STRIPE_MOBILE_WEB_ROADMAP.md` is out of date: it still talks about weekly and fortnightly Stripe prices. The phone app must not keep using Stripe for subscriptions.

The app people see is **Numi**. The package name is `com.tatindustries.numi`. The name on screen for the version is **1.0**. The number Play uses to tell one upload from the next is the version code. **25** is used. The next upload must be **26**.

---

## 1. The four places Numi lives

| Place | What it is | What updating it does |
| --- | --- | --- |
| The phone app | The Android app installed from Play | Changes only when a new signed file is uploaded to Play |
| The website | https://fit-pact.vercel.app | Changes when `git-push-update.bat` pushes to GitHub. Vercel rebuilds the site |
| Supabase | Sign-in, saved journeys, the billing function | The bat does not update this. A separate deploy command does |
| Stripe | How **Select Plan** charges today | Still connected. Must not be the phone's payment method for a public Play release |

The phone does not load the website. It carries its own copy of the screens. Refreshing the website does not change the phone.

Vercel stays. The public privacy page and the password-reset link use https://fit-pact.vercel.app. Turning Vercel off breaks those links even though the phone does not open the site for normal use.

---

## 2. What version 25 already includes on Play

- Dark screens, white pill buttons, glassy cards. A card lifts only while the mouse is over it.
- The four-stop guide: Profile, then TDEE, then Dashboard, then Macros. The blur stops on the button. There is no extra white line. It shows once on each phone or browser after sign-in. Done stores `numiPageGuideVersion` = `1`.
- The Dashboard Classification card wraps long words such as Overweight.
- The Annual badge is one line: **BEST VALUE (OVER 4 MONTHS FREE)**. It sits just inside the top of the Annual card.
- Prices on screen: Free $0, Monthly **$8.99**, Annual **$6.00** a month billed **$72** a year. These are labels. They are not the future Play prices.
- Home-screen icon on version 25: white “numi” on dark red. Version 26 replaces this with white “numi” on black. The logo inside the app stays white. The Play listing icon is a separate picture you upload in Play Console.
- Android 14 and newer can fill Monday through today from Health Connect. Tomorrow stays empty. Completed weeks are never rewritten. Typing over a day asks first. Yes keeps that number for the rest of the week. No puts the phone's number back. Connecting when days already have numbers asks first. Yes replaces a day only when the phone has steps above 0. No keeps typed days and fills blank days. Android 8 to 13 only ask the person to type. The website never asks.
- Oldest phone that can install it: Android 8.
- Idle sign-out is 5 minutes from the last tap. Leaving the app does not restart the clock. Coming back does. Sign-out is this phone only. Another phone stays signed in.
- Delete Account wipes the journey data, stays signed in, and opens My TDEE. It asks twice. It does not close the login.
- One plan card is Active. The brown buttons stay at the bottom of the cards. Do not add an empty gap on Free or Monthly to line them up with Annual.

## 2b. What version 26 adds (local, not on Play until you upload)

- Acclimation week labels wrap as Week N / Weight (kg). M–S day boxes open a one-day weight editor. Save Changes stores that day. Discard Changes warns only if the value changed. Complete Week remains the only way to mark a week complete and is allowed with missing days after a miss/inconsistency warning.
- Profile achievement icons stay hidden until Achievements is rolled out.
- Phone Average Weight is centred. Desktop Average Weight stays bottom-right.
- Clear All Data and Collapse Section stay inside the Acclimation card on phones.
- Header sits under the phone status bar. Bell shows “Notifications coming soon”.
- Activity Insight blank oval removed. Pending cancel buttons wrap on phones.
- Black launcher icon with transparent white wordmark layers.

---

## 3. What neither 25 nor 26 includes

- Google Play Billing. **Select Plan** on the phone still opens Stripe.
- The price change you chose for later: Monthly **$7.99**, Annual **$60** for the year, shown as **$5.00** a month. The badge stays “over 4 months free”. The yearly saving stays $35.88.
- iOS. That waits for a Mac and an Apple Developer account.
- A public web page where someone can delete an account without opening the app. The in-app wipe exists. Play still wants a web link before production.
- A friendlier sentence for the login “too many tries” message. The password button still shows Supabase’s own sentence. Leave the rate limit on.

Do not move version 25 from internal testing to production. Google requires Android apps that sell digital subscriptions to use Google Play Billing. Shipping the Stripe build as the public app can get the app rejected.

---

## 4. How to put version 26 on internal testing

Version code **26** is already set in `android/app/build.gradle`. Play rejects a second file with the same number. Do not type the number into the Android Studio bundle screens. There is no box for it.

1. Double-click `git-push-update.bat`. Wait until it says **Push complete**. That updates the website only. This UI pass does not need a Supabase or Stripe deploy.
2. Double-click `build-and-android-sync.bat`. Wait until it says **All done**. If it says **BUILD FAILED**, stop.
3. Open Android Studio. **File → Open**, and open the `android` folder inside the project. Let the sync finish.
4. **Build → Generate Signed Bundle / APK → Android App Bundle → Next**.
5. Use the existing key `android\numi-release-key.jks` and the same passwords. Do not create a new key. A new key cannot update the app already on Play.
6. Choose **release** and finish.
7. Upload this file to **Testing → Internal testing**:

   `C:\numi-build\app\outputs\bundle\release\app-release.aab`

   The build files go to `C:\numi-build` because the project path on OneDrive is too long for Windows. The source stays in the OneDrive folder.

8. The tester link is https://play.google.com/apps/internaltest/4701145150153936983

The signed file is not produced by the bat. The bat does not deploy Supabase or Stripe.

---

## 5. Why the phone must leave Stripe

Stripe is a card checkout on the web. Google Play Billing is Google’s own subscription system. For a subscription sold inside an Android app, Google requires Play Billing.

Today the phone still does this:

1. The person taps **Select Plan**.
2. A Supabase function named `billing` creates a Stripe checkout.
3. Stripe sends the person to a web page to pay.
4. Stripe tells the Supabase function, and the plan becomes Active.

That can stay for experiments on internal testing. It cannot be the payment method of the public Play app.

The website cannot use Play Billing. Play Billing only works inside an Android app installed from Play. When the phone moves to Play Billing, the website **Select Plan** button should tell the person to subscribe in the Android app. Confirm that sentence before it is written.

Leave Stripe in test mode. Do not create live Stripe prices for the phone. Stripe secrets that exist today are `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `STRIPE_WEBHOOK_SECRET`, and `APP_URL`. Test price IDs and live price IDs are not interchangeable.

Two billing actions, invoices and clear-billing, are in the code but are not live until this is run once, from the project folder, in Command Prompt:

```
npx supabase login
npx supabase functions deploy billing
```

That deploy does not switch the phone to Google. It only publishes the current Stripe function.

---

## 6. When you are ready for Google Billing

Do this only when you want to start the subscription work. Do not create the products and then promote version 25.

### 6.1 What you do in Play Console first

1. Open [Google Play Console](https://play.google.com/console) and open Numi.
2. Go to **Monetize with Play → Products → Subscriptions**.
3. Create two subscriptions and turn both on.
   - Monthly: renews every month. Price **$7.99**.
   - Annual: renews every year. Price **$60.00**.
4. Copy both product IDs. They look like `numi_monthly` and `numi_annual`. The exact text is whatever you type. Send those two IDs back in Cursor. Do not send a private key into the chat.
5. Open **License testing** (under Setup, or Monetize with Play settings) and add the Gmail addresses that will do test purchases. A license tester is not charged a real fee.
6. On the same Monetize page, read the fee Google keeps. For most subscription apps it is 15%. Confirm the number shown for this account before the first real charge.
7. Before the first real charge, ask an accountant about Australian GST. The app shows `$`, not `A$`.

A test purchase only works if the app was installed from Play, on a license-tester account. A copy installed from a USB cable usually cannot finish a purchase.

### 6.2 What you tell Cursor

Send:

- The monthly product ID
- The annual product ID
- Confirmation that the website button should say to subscribe in the Android app

Cursor then:

- Changes the cards to Monthly **$7.99** and Annual **$5.00** a month, billed **$60** yearly
- Leaves the badge as **BEST VALUE (OVER 4 MONTHS FREE)**, in the same place
- Leaves the “you save $35.88 every year” sentence, because $7.99 × 12 − $60 is still $35.88
- Makes **Select Plan** on the phone start a Google Play purchase
- Makes Cancel and Resume open Google’s subscription page, not Stripe
- Adds a server check so a purchase is confirmed with Google before the plan turns Active
- Sets the next version code to **26** (or the next free number if 26 is already used)
- Leaves Free, the Active and Inactive rules, and the plan-card layout alone

### 6.3 The one-time Google server setup

Play will not take Cursor’s word for a purchase. Google must confirm it.

1. In Google Cloud, use the project linked to this Play app.
2. Turn on the **Google Play Android Developer API**.
3. Create a service account.
4. In Play Console, **Users and permissions**, invite that service account and allow it to view financial data and manage orders.
5. Create a JSON key for that service account.
6. In Supabase, add that JSON as a secret yourself. Tell Cursor the secret’s name. Do not paste the JSON into chat.
7. Cursor adds the check to the Supabase billing function. You run `npx supabase functions deploy billing` again after that.

### 6.4 How you test the purchase

1. Build and upload the new file to internal testing, using the steps in section 4.
2. On the phone, update Numi from the tester link. The Google account on the phone must be a license tester.
3. Open **Payment details**, tap **Select Plan** on Monthly, and finish Google’s test sheet. You should not be charged.
4. Confirm the Monthly card says Active, and Annual says Inactive.
5. Repeat a test on Annual if you want both products checked.
6. Tap cancel and confirm it opens Google’s subscription screen, not a Stripe page.
7. On the website, confirm **Select Plan** does not open Stripe.

Only after those checks should you look at production.

---

## 7. Production, after billing works

Internal testing is not the public store. Before production, Play Console still needs:

- Store listing, screenshots, and the 512×512 listing icon you upload yourself
- Privacy policy URL: https://fit-pact.vercel.app/privacy
- A public account-deletion link. The in-app wipe is not enough for Play
- Data safety: email, name, weight, age, height, body fat, and steps from Health Connect
- The Health Connect declaration. Internal testing can exist without it. Production should not
- Content rating
- Target age: adults, not children
- Countries
- The publishing overview. Accounts created after November 2023 often need 12 testers opted in for 14 days on **closed** testing. Internal testing does not count toward that. Read the overview for this account rather than assuming

Use the same key file for every upload.

---

## 8. Small checks that are easy to forget

See the page guide again: press F12, open Console, paste `localStorage.removeItem("numiPageGuideVersion")`, press Enter, then press Ctrl+F5.

See the Health Connect question again: **Settings → Apps → Numi → Storage → Clear storage**, then sign in. This removes the saved answer and any steps that existed only on the phone. The saved journey loads again after sign-in.

Buttons on screen are shown in capitals (NEXT, DONE, SIGN IN) by the design. The words underneath are normal. Leave that unless you ask for sentence case.

iOS is not started. A Windows PC cannot build the iPhone app.
