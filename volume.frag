#version 150
//#extension GL_ARB_shading_language_420pack : require
#extension GL_ARB_explicit_attrib_location : require

#define TASK 10
#define ENABLE_OPACITY_CORRECTION 0
#define ENABLE_LIGHTNING 0
#define ENABLE_SHADOWING 0

in vec3 ray_entry_position;

layout(location = 0) out vec4 FragColor;

uniform mat4 Modelview;

uniform sampler3D volume_texture;
uniform sampler2D transfer_texture;


uniform vec3    camera_location;
uniform float   sampling_distance;
uniform float   sampling_distance_ref;
uniform float   iso_value;
uniform vec3    max_bounds;
uniform ivec3   volume_dimensions;

uniform vec3    light_position;
uniform vec3    light_ambient_color;
uniform vec3    light_diffuse_color;
uniform vec3    light_specular_color;
uniform float   light_ref_coef;


bool
inside_volume_bounds(const in vec3 sampling_position)
{
    return (   all(greaterThanEqual(sampling_position, vec3(0.0)))
            && all(lessThanEqual(sampling_position, max_bounds)));
}


float
get_sample_data(vec3 in_sampling_pos)
{
    vec3 obj_to_tex = vec3(1.0) / max_bounds;
    return texture(volume_texture, in_sampling_pos * obj_to_tex).r;
}

float
get_sample_data(float x, float y, float z)
{
    vec3 obj_to_tex = vec3(1.0) / max_bounds;
    return texture(volume_texture, vec3(x,y,z) * obj_to_tex).r;
}


vec3
binary_search(vec3 sampling_pos_low, vec3 sampling_pos_high, float epsilon_treshold, int condition)
{
	vec3 low_border = sampling_pos_low;
	vec3 high_border = sampling_pos_high;
	vec3 new_coordinates = (low_border + high_border)/2;
	float s = get_sample_data(new_coordinates);
	float difference = s - iso_value;
	int i = 0;

	// iterative
	while (difference != 0) {
		if (difference < epsilon_treshold || i >= condition) {
			break;
		}
		else if (difference > 0) {
			high_border = new_coordinates;
		}
		else if (difference < 0) {
			low_border = new_coordinates;
		}
		new_coordinates = (low_border + high_border)/2;
		s = get_sample_data(new_coordinates);
		difference = s - iso_value;
		i++;
	}

	return new_coordinates;


	// if (difference == 0 || difference <= epsilon_treshold) {
	// 	return new_coordinates;
	// }
	// else if (difference > 0) {
	// 	return binary_search(sampling_pos_low, new_coordinates, epsilon_treshold);
	// }
	// else if (difference < 0) {
	// 	return binary_search(new_coordinates, sampling_pos_high, epsilon_treshold);
	// }
}

vec3
get_gradient(vec3 sampling_pos)
{
    vec3 steps = max_bounds / volume_dimensions;

    float x = (get_sample_data(sampling_pos.x + steps.x, sampling_pos.y, sampling_pos.z) - 
                get_sample_data(sampling_pos.x - steps.x, sampling_pos.y, sampling_pos.z)) / 2;
    float y = (get_sample_data(sampling_pos.x, sampling_pos.y + steps.y, sampling_pos.z) -
                get_sample_data(sampling_pos.x, sampling_pos.y - steps.y, sampling_pos.z)) / 2;
    float z = (get_sample_data(sampling_pos.x, sampling_pos.y, sampling_pos.z + steps.z) -
                get_sample_data(sampling_pos.x, sampling_pos.y, sampling_pos.z - steps.z)) / 2;
    return vec3(x,y,z);
}


void main()
{
    /// One step trough the volume
    vec3 ray_increment      = normalize(ray_entry_position - camera_location) * sampling_distance;
    /// Position in Volume
    vec3 sampling_pos       = ray_entry_position + ray_increment; // test, increment just to be sure we are in the volume

    /// Init color of fragment
    vec4 dst = vec4(0.0, 0.0, 0.0, 0.0);

    /// check if we are inside volume
    bool inside_volume = inside_volume_bounds(sampling_pos);
    
    if (!inside_volume)
        discard;

#if TASK == 10
    vec4 max_val = vec4(0.0, 0.0, 0.0, 0.0);
    
    // the traversal loop,
    // termination when the sampling position is outside volume boundarys
    // another termination condition for early ray termination is added
    while (inside_volume) 
    {      
        // get sample
        float s = get_sample_data(sampling_pos);
                
        // apply the transfer functions to retrieve color and opacity
        vec4 color = texture(transfer_texture, vec2(s, s));
           
        // this is the example for maximum intensity projection
        max_val.r = max(color.r, max_val.r);
        max_val.g = max(color.g, max_val.g);
        max_val.b = max(color.b, max_val.b);
        max_val.a = max(color.a, max_val.a);
        
        // increment the ray sampling position
        sampling_pos  += ray_increment;

        // update the loop termination condition
        inside_volume  = inside_volume_bounds(sampling_pos);
    }

    dst = max_val;
#endif 
    
#if TASK == 11
	
	vec4 sum_val = vec4(0.0, 0.0, 0.0, 0.0);
	int times = 0;
    // the traversal loop,
    // termination when the sampling position is outside volume boundarys
    // another termination condition for early ray termination is added
    while (inside_volume)
    {      
        // get sample
        float s = get_sample_data(sampling_pos);

        // apply the transfer functions to retrieve color and opacity
        vec4 color = texture(transfer_texture, vec2(s, s));

     	// sum up
        sum_val += color;
        
        // increment the ray sampling position
        sampling_pos  += ray_increment;

        // update the loop termination condition
        inside_volume  = inside_volume_bounds(sampling_pos);

        times++;
    }

    // return average
    dst = sum_val/times;
#endif
    
#if TASK == 12 || TASK == 13
	vec4 color = vec4(0.0, 0.0, 0.0, 0.0);
	vec3 old_pos = vec3(0.0, 0.0, 0.0);
	float old_s = 0.0;
    // the traversal loop,
    // termination when the sampling position is outside volume boundarys
    // another termination condition for early ray termination is added
    while (inside_volume)
    {
        // get samples (density values)
        float s = get_sample_data(sampling_pos);

        #if TASK == 12			// basic
        	// testing if sample is the correct one
        	// Problem: gets only the same or higher density values (in this case enough)
        	if (s - iso_value >= 0) {
        		// apply the transfer functions to retrieve color and opacity
        		color = texture(transfer_texture, vec2(s, s));
       			dst = color;	// set color
       			break;			// break while-loop
        	}
        #endif

        vec3 test = vec3(0.0);
        #if TASK == 13 			// Binary Search
        	if (s - iso_value >= 0 && old_s - iso_value < 0 && old_s != 0.0) {
        		vec3 new_coordinates = binary_search(old_pos, sampling_pos, 0.0000001, 100000);
        		float new_s = get_sample_data(new_coordinates);
        		// apply the transfer functions to retrieve color and opacity
        		color = texture(transfer_texture, vec2(new_s, new_s));
       			dst = color;	// set color
                test = get_gradient(new_coordinates);
                test = normalize(test);
                color = vec4(test.x, test.y, test.z, 1.0);
                dst = color;    // set color

		        #if ENABLE_LIGHTNING == 1 // Add Shading
                    // test = (1/(sqrt(test.x*test.x + test.y*test.y + test.z*test.z)) )* test;
                    #if ENABLE_SHADOWING == 1 // Add Shadows
                        IMPLEMENTSHADOW;
                    #endif
		        #endif
                break;          // break while-loop
            }
        #endif

		// old values for Binary Search
		old_pos = sampling_pos;
        old_s = get_sample_data(sampling_pos);

		// increment the ray sampling position
        sampling_pos += ray_increment;

        // update the loop termination condition
        inside_volume = inside_volume_bounds(sampling_pos);
    }
#endif 

#if TASK == 31
    // the traversal loop,
    // termination when the sampling position is outside volume boundarys
    // another termination condition for early ray termination is added
    while (inside_volume)
    {
        // get sample
#if ENABLE_OPACITY_CORRECTION == 1 // Opacity Correction
        IMPLEMENT;
#else
        float s = get_sample_data(sampling_pos);
#endif
        // dummy code
        dst = vec4(light_specular_color, 1.0);

        // increment the ray sampling position
        sampling_pos += ray_increment;

#if ENABLE_LIGHTNING == 1 // Add Shading
        IMPLEMENT;
#endif

        // update the loop termination condition
        inside_volume = inside_volume_bounds(sampling_pos);
    }
#endif 

    // return the calculated color value
    FragColor = dst;
}

