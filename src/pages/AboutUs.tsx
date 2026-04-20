import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MaterialIcon } from "@/components/ui/material-icon";

const AboutUs = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">About Numi</h1>
        <p className="text-muted-foreground">Your personal fitness companion</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-lg leading-relaxed">
            Numi is designed to help you achieve your health and fitness goals through
            personalized calculations and tracking. We combine science-based TDEE calculations with
            macro tracking to provide you with the tools you need to succeed.
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <MaterialIcon name="gps_fixed" className="mb-2 text-primary" size="lg" />
            <CardTitle>Our Mission</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              To empower individuals with accurate, personalized fitness data to make informed
              decisions about their health journey.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <MaterialIcon name="group" className="mb-2 text-primary" size="lg" />
            <CardTitle>Our Community</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Join thousands of users who are transforming their health with data-driven insights
              and personalized recommendations.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <MaterialIcon name="favorite" className="mb-2 text-primary" size="lg" />
            <CardTitle>Our Values</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              We believe in transparency, accuracy, and providing tools that are accessible to
              everyone, regardless of their fitness level.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Our Story</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <p>
            Numi was created by fitness enthusiasts who understand the importance of
            accurate calorie and macro tracking. We noticed that many fitness apps were either too
            complicated or lacked the precision needed for serious results.
          </p>
          <p className="mt-4">
            Our team developed Numi to bridge that gap — providing professional-grade
            calculations in an easy-to-use interface that anyone can master.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AboutUs;
