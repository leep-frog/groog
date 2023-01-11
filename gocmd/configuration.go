package main

// See this link for more details:
// https://code.visualstudio.com/api/references/contribution-points#contributes.configuration

type JSONSchemaType interface {
	ToJSONSchema() map[string]interface{}
}

type JSONSchema struct {
	SchemaType JSONSchemaType
	Options    map[string]interface{}
}

func NewJSONSchema(t JSONSchemaType, opts ...JSONSchemaOption) *JSONSchema {
	m := map[string]interface{}{}
	for _, optMap := range opts {
		for k, v := range optMap {
			m[k] = v
		}
	}
	return &JSONSchema{t, m}
}

func NewJSONArray(items *JSONSchema, opts ...JSONSchemaOption) *JSONSchema {
	return NewJSONSchema(&JSONSchemaArray{items}, opts...)
}

func NewJSONString(opts ...JSONSchemaOption) *JSONSchema {
	return NewJSONSchema(&JSONSchemaString{}, opts...)
}

func NewJSONObject(properties map[string]*JSONSchema, opts ...JSONSchemaOption) *JSONSchema {
	return NewJSONSchema(&JSONSchemaObject{properties}, opts...)
}

func (s *JSONSchema) evaluate() map[string]interface{} {
	r := s.SchemaType.ToJSONSchema()
	for k, v := range s.Options {
		r[k] = v
	}
	return r
}

func groogConfiguration() *Configuration {
	return &Configuration{
		"Groog",
		map[string]map[string]interface{}{
			"groog.typos": typosSchema().evaluate(),
		},
	}
}

type Configuration struct {
	Title      string                            `json:"title"`
	Properties map[string]map[string]interface{} `json:"properties"`
}

type JSONSchemaOption map[string]interface{}

func JSONDescription(desc string) JSONSchemaOption {
	return map[string]interface{}{
		"description": desc,
	}
}

func JSONMarkdownDescription(mdDesc string) JSONSchemaOption {
	return map[string]interface{}{
		"markdownDescription": mdDesc,
	}
}

func JSONDefault(v interface{}) JSONSchemaOption {
	return map[string]interface{}{
		"default": v,
	}
}

func JSONOrder(order int) JSONSchemaOption {
	return map[string]interface{}{
		"order": order,
	}
}

type JSONSchemaArray struct {
	items *JSONSchema
}

func (a *JSONSchemaArray) ToJSONSchema() map[string]interface{} {
	return map[string]interface{}{
		"type":  "array",
		"items": a.items.evaluate(),
	}
}

type JSONSchemaString struct{}

func (s *JSONSchemaString) ToJSONSchema() map[string]interface{} {
	return map[string]interface{}{
		"type": "string",
	}
}

type JSONSchemaObject struct {
	properties map[string]*JSONSchema
}

func (o *JSONSchemaObject) ToJSONSchema() map[string]interface{} {
	props := map[string]interface{}{}
	for k, v := range o.properties {
		props[k] = v.evaluate()
	}
	return map[string]interface{}{
		"type":       "object",
		"properties": props,
	}
}
