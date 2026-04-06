import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Privacy = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Introduction</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none space-y-3">
          <p>
            Welcome to Weight Loss Buddy ("we", "our", "us", or the "App"). We are committed to protecting
            your personal information and your right to privacy. This Privacy Policy explains what information
            we collect, how we use it, and your rights in relation to it.
          </p>
          <p>
            By using Weight Loss Buddy, you agree to the collection and use of information in accordance
            with this policy.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Information We Collect</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none space-y-3">
          <p>We collect only the information necessary to provide you with accurate and personalised fitness recommendations:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Personal details:</strong> Name, email address, age, gender, and mobile number (optional).</li>
            <li><strong>Physical data:</strong> Height, current weight, and activity level — used to calculate your BMR, TDEE, macronutrient breakdown, and recommended calorie intake.</li>
            <li><strong>Tracking data:</strong> Daily weight entries, step counts, calorie intake, and weekly progress data — used to monitor your journey and adjust recommendations.</li>
            <li><strong>Profile content:</strong> Profile photo, personal description, goals, and motivational notes you choose to add.</li>
            <li><strong>Support correspondence:</strong> Information you provide when contacting our support team.</li>
          </ul>
          <p>
            We do <strong>not</strong> collect location data, browsing history, contacts, or any information
            unrelated to providing our fitness recommendations.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. How We Use Your Information</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none space-y-3">
          <p>Your information is used solely to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Calculate your Total Daily Energy Expenditure (TDEE), Basal Metabolic Rate (BMR), Body Mass Index (BMI), and estimated body fat percentage.</li>
            <li>Provide personalised calorie, step, and macronutrient recommendations.</li>
            <li>Track your weight loss progress across acclimation and weight loss phases.</li>
            <li>Adjust your recommendations based on weekly progress (e.g. step increases, calorie reductions).</li>
            <li>Display your achievements and streak data.</li>
            <li>Respond to support enquiries.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Data Sharing</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none space-y-3">
          <p>
            <strong>We do not sell, trade, rent, or share your personal information with third parties</strong> for
            marketing or any other purpose unrelated to the operation of this App.
          </p>
          <p>We may only share information in the following limited circumstances:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Legal requirements:</strong> If required by law, regulation, or legal process.</li>
            <li><strong>Service providers:</strong> With trusted third-party services (e.g. hosting, payment processing) strictly necessary to operate the App, bound by confidentiality agreements.</li>
            <li><strong>With your consent:</strong> If you explicitly consent to sharing specific data.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5. Data Storage & Security</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none space-y-3">
          <p>
            We implement industry-standard security measures to protect your personal information from
            unauthorised access, alteration, disclosure, or destruction. Your data is stored securely and
            access is restricted to authorised personnel only.
          </p>
          <p>
            While we strive to use commercially acceptable means to protect your data, no method of
            electronic transmission or storage is 100% secure, and we cannot guarantee absolute security.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>6. Data Retention</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none space-y-3">
          <p>
            We retain your personal data only for as long as necessary to provide the services described
            in this policy. You may request deletion of your data at any time by contacting us through the
            Community & Help page.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>7. Your Rights</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none space-y-3">
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Access</strong> the personal data we hold about you.</li>
            <li><strong>Correct</strong> inaccurate or incomplete data.</li>
            <li><strong>Delete</strong> your data ("right to be forgotten").</li>
            <li><strong>Withdraw consent</strong> at any time where processing is based on consent.</li>
            <li><strong>Data portability</strong> — receive your data in a structured, commonly used format.</li>
          </ul>
          <p>
            To exercise any of these rights, please contact us via the Community & Help page.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>8. Health & Medical Disclaimer</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none space-y-3">
          <p>
            <strong>Weight Loss Buddy is not a medical device, medical service, or substitute for professional
            medical advice, diagnosis, or treatment.</strong> The App provides general fitness and nutritional
            information based on the data you enter. All calculations (BMR, TDEE, BMI, body fat estimates,
            calorie and macro recommendations) are estimates only and may not be accurate for all individuals.
          </p>
          <p>
            <strong>Limitation of Liability:</strong> To the fullest extent permitted by applicable law,
            Weight Loss Buddy, its creators, developers, affiliates, and partners shall not be held liable
            for any direct, indirect, incidental, consequential, or special damages — including but not
            limited to injury, illness, health complications, hospitalisation, or death — arising from or
            in connection with your use of the App, its recommendations, or any decisions made based on
            information provided by the App.
          </p>
          <p>
            <strong>You acknowledge and agree that:</strong>
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>You use this App entirely at your own risk.</li>
            <li>You should always consult a qualified medical professional, doctor, or registered dietitian before starting any diet, exercise, or weight loss programme.</li>
            <li>The App's calorie and macronutrient recommendations are general guidelines and are not tailored to individual medical conditions, allergies, eating disorders, or other health concerns.</li>
            <li>Weight Loss Buddy does not diagnose, treat, cure, or prevent any disease or medical condition.</li>
            <li>You are solely responsible for monitoring your health and well-being while using this App.</li>
            <li>If you experience any adverse health effects while using this App, discontinue use immediately and seek medical attention.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>9. Children's Privacy</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none space-y-3">
          <p>
            Weight Loss Buddy is not intended for use by individuals under the age of 18. We do not
            knowingly collect personal information from children. If we become aware that we have
            collected data from a person under 18, we will take steps to delete that information promptly.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>10. Changes to This Privacy Policy</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none space-y-3">
          <p>
            We may update this Privacy Policy from time to time. Any changes will be reflected on this page
            with an updated "Last updated" date. We encourage you to review this policy periodically.
            Continued use of the App after changes constitutes acceptance of the updated policy.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>11. Contact Us</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none space-y-3">
          <p>
            If you have any questions, concerns, or requests regarding this Privacy Policy or how your
            data is handled, please contact us through the Community & Help page or email us at{" "}
            <a href="mailto:alan.tat@hotmail.com" className="text-primary hover:underline">
              alan.tat@hotmail.com
            </a>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Privacy;
