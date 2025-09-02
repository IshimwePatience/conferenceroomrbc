FROM openjdk:17-jdk-slim

# Set timezone to Africa/Kigali
ENV TZ=Africa/Kigali
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Set working directory
WORKDIR /app

# Copy maven wrapper and pom.xml
COPY mvnw ./
COPY .mvn .mvn
COPY pom.xml ./

# Copy source code
COPY src ./src

# Make mvnw executable
RUN chmod +x mvnw

# Build the application
RUN ./mvnw clean package -DskipTests

# Expose port (updated to match application.properties)
EXPOSE 8084

# Run the application
CMD java -jar target/*.jar